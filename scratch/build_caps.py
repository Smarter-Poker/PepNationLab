import os

scad_code = """
module cap() {
    difference() {
        cylinder(h=8.5+1.3, d=14.9+2.6, $fn=100);
        translate([0,0,-0.1]) cylinder(h=8.5+0.1, d=14.9, $fn=100);
        // chamfer
        translate([0,0,-0.1]) cylinder(h=0.4+0.1, d1=14.9+0.8, d2=14.9, $fn=100);
    }
    // Logo
    translate([0,0,8.5+1.3]) {
        linear_extrude(0.7) {
            text("SAVAGE", size=2.5, halign="center", valign="bottom", font="Impact");
            translate([0,-0.5,0]) text("BRANDS", size=2.5, halign="center", valign="top", font="Impact");
        }
    }
}

// 20 caps array
for(x=[0:4]) {
    for(y=[0:3]) {
        translate([x*25, y*25, 0]) cap();
        // brim
        translate([x*25, y*25, 0]) cylinder(h=0.2, d=22, $fn=100);
    }
}
"""

with open("/Users/smarter.poker/Documents/pepnationlab/scratch/savage_20_caps.scad", "w") as f:
    f.write(scad_code)
    
print("Saved to Desktop!")
