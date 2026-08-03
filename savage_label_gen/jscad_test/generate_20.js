const fs = require('fs');
const { createOpenSCAD } = require('openscad-wasm');

const scadCode = `
// Savage Brands Vial Over-cap - 20 Piece Array with Custom Brims
internal_d = 14.9;
internal_r = internal_d / 2;
internal_depth = 8.5;
wall_thickness = 1.3;
chamfer = 0.4;
emboss_height = 0.7;

outer_r = internal_r + wall_thickness;
total_height = internal_depth + wall_thickness;

$fn = 60; // Slightly lower resolution for faster rendering of 20 pieces, but still smooth

module cap_body() {
    difference() {
        cylinder(r=outer_r, h=total_height);
        translate([0, 0, -0.01])
            cylinder(r=internal_r, h=internal_depth + 0.01);
        translate([0, 0, -0.01])
            cylinder(r1=internal_r + chamfer, r2=internal_r, h=chamfer + 0.01);
    }
}

module custom_brim() {
    // 0.2mm thick, extends 6mm past the edge of the cap to prevent lifting
    cylinder(r=outer_r + 6, h=0.2);
}

module slash() {
    polygon(points=[[-4, -0.2], [4, -0.6], [4, 0.6], [-4, 0.2]]);
}

module slash_marks() {
    rotate([0, 0, -35]) {
        translate([0, 2.5, 0]) slash();
        slash();
        translate([0, -2.5, 0]) slash();
    }
}

module savage_logo() {
    difference() {
        union() {
            translate([0, 1.5, 0])
                linear_extrude(height=emboss_height)
                text("SAVAGE", font="Impact", size=3, halign="center", valign="center", spacing=1.1);
            translate([0, -1.8, 0])
                linear_extrude(height=emboss_height)
                text("BRANDS", font="Impact", size=2, halign="center", valign="center", spacing=1.1);
        }
        translate([0, 0, -0.1])
            linear_extrude(height=emboss_height + 0.2)
            slash_marks();
    }
}

module single_cap() {
    union() {
        custom_brim(); // Add custom brim for bed adhesion
        cap_body();
        translate([0, 0, total_height]) savage_logo();
    }
}

// Generate 5x4 Grid (20 caps total)
for (x = [0 : 4]) {
    for (y = [0 : 3]) {
        // Space them 32mm apart (brim diameter is ~29.5mm)
        translate([x * 32, y * 32, 0]) single_cap();
    }
}
`;

(async () => {
    try {
        console.log("Loading OpenSCAD WASM...");
        const instance = await createOpenSCAD();
        console.log("Generating STL for 20 caps (This may take a minute)...");
        const stlData = await instance.renderToStl(scadCode);
        fs.writeFileSync('/Users/smarter.poker/.gemini/antigravity/brain/a19f9938-5124-4d98-ab0e-d8f465f94f69/savage_20_caps_array.stl', stlData);
        fs.writeFileSync('/Users/smarter.poker/.gemini/antigravity/brain/a19f9938-5124-4d98-ab0e-d8f465f94f69/savage_20_caps_array.scad', scadCode);
        console.log('20-cap STL generated successfully.');
    } catch (err) {
        console.error("ERROR generating STL:", err);
    }
})();
