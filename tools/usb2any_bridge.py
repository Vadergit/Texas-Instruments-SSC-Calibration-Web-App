"""Experimental TI USB2ANY SDK transport for PGAxxxEVM-034.
Run only on Windows with original matching-bitness SDK DLL.
Serves the checked-out web app on loopback, no CORS / no remote clients.
No vendor binary redistributed. See docs/PGA300-ADAPTERS.md.
"""
import argparse
import ctypes as C
import json
import pathlib
import re
import secrets
import sys
import time
from http.server import HTTPServer, SimpleHTTPRequestHandler

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8765"
TOKEN = secrets.token_urlsafe(32)

def write_allowed(p, a, v):
    if p == 0 and a == 12:
        return v in (0, 3)
    if p == 2:
        masks = {0x30:255,0x31:63,0x39:1,0x3b:31,0x46:7,0x47:0x9f,0x48:0x83,0x4c:0x7f,0x67:9}
        return a in masks and v & ~masks[a] == 0
    if p == 5:
        return 0x80 <= a <= 0x87 or (a == 0x88 and v < 16) or (a == 0x89 and v == 4) or (a == 0x8a and v == 1)
    return False

class USB2ANY:
    def __init__(self, args):
        self.args = args
        self.h = None
        self.active = False
        self.dll = C.WinDLL(str(pathlib.Path(args.dll).resolve()))
        B, W, I, H, P = C.c_ubyte, C.c_uint16, C.c_int, C.c_void_p, C.POINTER(C.c_ubyte)
        for name, ret, types in [
            ('u2aFindControllers', I, []), ('u2aGetSerialNumber', I, [I,C.c_char_p]),
            ('u2aOpen', H, [C.c_char_p]), ('u2aClose', I,[H]),
            ('u2aUART_Control', I,[H,W,W,W,W,W]), ('u2aUART_Write', I,[H,B,P]),
            ('u2aUART_Read', I,[H,B,P]), ('u2aUART_GetRxCount', I,[H]),
            ('u2aGPIO_SetPort', I,[H,B,B]), ('u2aGPIO_WritePort', I,[H,B,B]),
            ('u2aGPIO_WritePulse', I,[H,B,B,W]), ('u2aPower_Enable', I,[H,I,I,I])]:
            fn = getattr(self.dll,name); fn.restype=ret; fn.argtypes=types
    def call(self,name,*a):
        n = getattr(self.dll,name)(self.h,*a)
        if n < 0: raise RuntimeError(f'{name}: TI SDK error {n}')
        return n
    def open(self):
        if self.h is not None: return
        count = self.dll.u2aFindControllers()
        if count != 1 and not self.args.serial: raise RuntimeError('Exactly one USB2ANY required or specify --serial.')
        serial = self.args.serial
        if not serial:
            buf=C.create_string_buffer(64)
            if self.dll.u2aGetSerialNumber(0,buf)<0: raise RuntimeError('Cannot read USB2ANY serial.')
            serial=buf.value.decode('ascii')
        h=self.dll.u2aOpen(serial.encode('ascii'))
        if not h or h >= (1 << (C.sizeof(C.c_void_p)*8-1)): raise RuntimeError('Cannot open USB2ANY. Close TI GUI first.')
        self.h=h
    def gpio(self,pin,high):
        self.call('u2aGPIO_SetPort',pin,1)
        self.call('u2aGPIO_WritePort',pin,2 if high else 1)
    def tx(self,*data):
        b=(C.c_ubyte*len(data))(*data)
        self.call('u2aUART_Write',len(data),b)
    def rx(self,n):
        b=(C.c_ubyte*n)()
        got=self.call('u2aUART_Read',n,b)
        return bytes(b[:got])
    def drain(self):
        for _ in range(8):
            n=self.call('u2aUART_GetRxCount')
            if n==0: return
            self.rx(min(n,64))
        raise RuntimeError('Unexpected UART traffic')
    def activate(self):
        self.open()
        self.call('u2aPower_Enable',2,1,2) # 5 V switch supply for EVM mux
        self.gpio(10,False) # no VDD raise
        self.gpio(11,False) # activation route
        self.gpio(7,False)
        self.call('u2aUART_Control',0,0,0,0,0)
        try:
            for gap in (0.012,0.012,0.125,0.05,0.05,0):
                self.call('u2aGPIO_WritePulse',7,1,5000)
                time.sleep(gap)
        finally:
            self.gpio(7,False)
        self.gpio(11,True) # OWI UART route
        self.drain()
        self.active=True
    def read_reg(self,p,a):
        self.drain()
        self.tx(0x55,(p<<4)|2,a)
        time.sleep(0.004)
        self.drain()
        self.tx(0x55,0x73)
        deadline=time.monotonic()+0.25
        while time.monotonic()<deadline:
            n=self.call('u2aUART_GetRxCount')
            if n:
                data=self.rx(min(n,64))
                if len(data)!=1: raise RuntimeError('OWI echo / invalid response')
                return data[0]
            time.sleep(.002)
        raise RuntimeError('OWI_TIMEOUT')
    def write_reg(self,p,a,v):
        if not write_allowed(p,a,v): raise RuntimeError('WRITE_NOT_ALLOWED')
        self.tx(0x55,(p<<4)|1,a,v)
        time.sleep(.005)
        if (p,a,v)==(0,12,0): self.active=False
    def close(self):
        if self.h is not None:
            try:
                if self.active: self.write_reg(0,12,0)
            finally:
                h=self.h; self.h=None; self.active=False
                self.dll.u2aClose(h)
    def command(self,cmd):
        if cmd=='INFO': self.open(); return 'TI-USB2ANY'
        if cmd=='HELLO': self.open(); return 'PGA300-BRIDGE 2 9600'
        if cmd=='ACT': self.activate(); return ''
        if cmd=='CLOSE': self.close(); return ''
        if not self.active: raise RuntimeError('ACT_REQUIRED')
        m=re.fullmatch(r'(R|W) ([0-9A-Fa-f]{2}) ([0-9A-Fa-f]{2})(?: ([0-9A-Fa-f]{2}))?',cmd)
        if not m: raise RuntimeError('INVALID_COMMAND')
        op,p,a,v=m.groups(); p=int(p,16); a=int(a,16)
        if p not in (0,2,5): raise RuntimeError('INVALID_PAGE')
        if op=='R' and v is None: return f'{self.read_reg(p,a):02X}'
        if op=='W' and v is not None: self.write_reg(p,a,int(v,16)); return ''
        raise RuntimeError('INVALID_COMMAND')

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
    def valid_host(self): return self.headers.get('Host')=='127.0.0.1:8765'
    def reply(self,status,obj):
        b=json.dumps(obj).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
    def do_GET(self):
        if not self.valid_host(): self.send_error(403); return
        if self.path=='/api/usb2any/session':
            if self.headers.get('Sec-Fetch-Site') not in ('same-origin','none'): self.send_error(403);return
            self.reply(200,{'token':TOKEN});return
        # Do not serve hidden files or arbitrary directories.
        if any(x.startswith('.') for x in self.path.split('/') if x): self.send_error(403);return
        super().do_GET()
    def do_POST(self):
        if not self.valid_host() or self.path!='/api/usb2any/command' or self.headers.get('Origin')!=BASE or not secrets.compare_digest(self.headers.get('X-PGA-Token',''),TOKEN):
            self.send_error(403);return
        try:
            n=int(self.headers.get('Content-Length','0'))
            if not 0<n<=256: raise ValueError('Invalid length')
            cmd=json.loads(self.rfile.read(n))['command']
            if not isinstance(cmd,str) or len(cmd)>40: raise ValueError('Invalid command')
            self.reply(200,{'ok':True,'data':self.server.adapter.command(cmd)})
        except Exception as e: self.reply(400,{'ok':False,'error':str(e)})

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--dll',required=True,help='Path to original USB2ANY.dll')
    p.add_argument('--serial',help='USB2ANY serial number when multiple devices are present')
    p.add_argument('--confirm-evm034',action='store_true',help='Confirm EVM-034 schematic, jumpers, external power and scope validation')
    args=p.parse_args()
    if sys.platform!='win32': p.error('TI SDK DLL requires Windows')
    if not args.confirm_evm034: p.error('Check SLDU011B Fig. 17-19 and correct wiring first; use --confirm-evm034')
    adapter=USB2ANY(args)
    server=HTTPServer(('127.0.0.1',8765),Handler);server.adapter=adapter
    print(BASE+'/?model=pga300')
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally:
        try: adapter.close()
        finally: server.server_close()
if __name__=='__main__': main()
