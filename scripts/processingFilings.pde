ArrayList<PVector> charges;
PVector mousePressedPos;
float theta = 0;
int num=150;
float offset, step;
float maxRad = 200;

float u = 0.1;

void setup(){
  
  size(500,500);
  step = (float)width/num;
  offset = step/2.0;
  
  charges = new ArrayList<PVector>();
  stroke(100,180,100);
 // strokeWeight(2);
  //noSmooth();
}


void draw(){

 // background(180,200,200);
  background(255);
    
    for(int i = 0; i < num; ++i){
      for(int j = 0; j < num; j++){
         
         PVector p = new PVector(i*step+offset, j*step+offset, 0);
         PVector v = new PVector(0,0,0);
         
         for(int k = 0; k < charges.size(); ++k){
           PVector dp = charges.get(k); 
           
           PVector n = PVector.sub(dp, p);
           PVector m = PVector.sub(p, dp);
           m.mult(dp.z);
            
           float rT = pow(n.mag(), 3);
           
           n.normalize();
           
           float nDm = PVector.dot(n,m);
           n.mult(3*nDm);
           n.sub(m);
           n.div(rT);
      
           v.add(n);
         }
         
         v.mult(u/(4*PI));
         
         drawArrow(p.x, p.y, atan2(v.y, v.x), v.mag());
         
      }
    }
  
}

void mousePressed(){
 
  int z = mouseButton == LEFT ? 1 : -1;
  mousePressedPos = new PVector(mouseX, mouseY, z);
  charges.add(mousePressedPos);

}



void drawArrow(float x, float y, float i_theta, float i_mag){
 
  pushMatrix();
  translate(x, y);
  //scale(pow(i_mag,.05));
  rotate(i_theta);
  line(0,0,width/(num+0.0),0);
  //line(width/(num+0.0),0, 3*width/(4.0*num), width/(4.0*num));
  //line(width/(num+0.0),0, 3*width/(4.0*num), -width/(4.0*num));
  popMatrix();
  
}