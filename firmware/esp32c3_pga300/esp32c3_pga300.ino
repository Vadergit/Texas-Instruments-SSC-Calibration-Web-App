/* Experimental PGA300 OWI bridge for ESP32-C3, Arduino core.
 * External voltage modulator + current demodulator REQUIRED.
 * No direct electrical connection from MCU GPIO to PGA300 PWR!
 * GPIO4 UART TX -> external voltage modulator (high idle).
 * GPIO5 UART RX <- external current decoder (3.3 V logic, idle high, no TX echo).
 * GPIO6 ACT -> external activation overvoltage switch (active high).
 * USB CDC at boot enabled; UART1 at experimental 38,400 baud (validate scope).
 */
#include <Arduino.h>
HardwareSerial owi(1);
constexpr int TX=4,RX=5,ACT=6;
constexpr uint32_t RATE=38400;
bool activated=false;
String line;
void frame(const uint8_t* p,size_t n){owi.write((uint8_t)0x55);owi.write(p,n);owi.flush();}
bool readReg(uint8_t page,uint8_t addr,uint8_t &v){
 while(owi.available())owi.read();
 uint8_t init[]={uint8_t((page<<4)|2),addr};frame(init,2);
 delayMicroseconds(150);
 while(owi.available())owi.read();
 uint8_t response=0x73;frame(&response,1);
 uint32_t start=micros();while(!owi.available()&&(uint32_t)(micros()-start)<10000)delayMicroseconds(10);
 if(!owi.available())return false;v=owi.read();
 delayMicroseconds(400);if(owi.available()){while(owi.available())owi.read();return false;}return true;
}
void writeReg(uint8_t page,uint8_t addr,uint8_t v){uint8_t b[]={uint8_t((page<<4)|1),addr,v};frame(b,3);delayMicroseconds(150);}
void activate(){
 digitalWrite(ACT,LOW);delay(30);
 for(int i=0;i<3;i++){digitalWrite(ACT,HIGH);delay(5);digitalWrite(ACT,LOW);if(i!=2)delay(15);}
 delay(130);
 for(int i=0;i<3;i++){digitalWrite(ACT,HIGH);delay(5);digitalWrite(ACT,LOW);if(i!=2)delay(60);}
 delay(10);activated=true;
}
void answer(unsigned long id,const char* status,const char* data=""){Serial.printf("%lu %s%s%s\n",id,status,*data?" ":"",data);}
bool writeAllowed(unsigned p,unsigned a,unsigned v){
 if(p==0&&a==12)return v==0||v==3;
 if(p==2){switch(a){case 0x30:return true;case 0x31:return v<64;case 0x39:return v<2;case 0x3b:return v<32;case 0x46:return !(v&~7);case 0x47:return !(v&~0x9f);case 0x48:return !(v&~0x83);case 0x4c:return !(v&~0x7f);case 0x67:return !(v&~9);}}
 if(p==5){if(a>=0x80&&a<=0x87)return true;if(a==0x88)return v<16;if(a==0x89)return v==4;if(a==0x8a)return v==1;}
 return false;
}
void handle(String s){
 unsigned long id=0;char cmd[12]={0};unsigned p=0,a=0,v=0;int n=sscanf(s.c_str(),"%lu %11s %x %x %x",&id,cmd,&p,&a,&v);
 if(n<2)return;
 if(!strcmp(cmd,"HELLO")&&n==2){answer(id,"OK","PGA300-BRIDGE 1");return;}
 if(!strcmp(cmd,"ACT")&&n==2){activate();answer(id,"OK");return;}
 if(!activated){answer(id,"ERR","ACT_REQUIRED");return;}
 if((p!=0&&p!=2&&p!=5)||a>255||v>255){answer(id,"ERR","RANGE");return;}
 if(!strcmp(cmd,"R")&&n==4){uint8_t data;if(!readReg(p,a,data)){answer(id,"ERR","OWI_TIMEOUT_OR_ECHO");return;}char out[3];snprintf(out,sizeof(out),"%02X",data);answer(id,"OK",out);return;}
 if(!strcmp(cmd,"W")&&n==5&&writeAllowed(p,a,v)){writeReg(p,a,v);if(p==0&&a==12&&v==0)activated=false;answer(id,"OK");return;}
 answer(id,"ERR","COMMAND_OR_WRITE_NOT_ALLOWED");
}
void setup(){pinMode(ACT,OUTPUT);digitalWrite(ACT,LOW);Serial.begin(115200);owi.begin(RATE,SERIAL_8N1,RX,TX);}
void loop(){while(Serial.available()){char c=Serial.read();if(c=='\n'){handle(line);line="";}else if(c!='\r'){if(line.length()<120)line+=c;else line="";}}}
