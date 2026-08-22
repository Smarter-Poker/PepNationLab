const fs = require('fs');
const { createOpenSCAD } = require('openscad-wasm');

const scadCode = `
// Savage Brands Vial Over-cap
internal_d = 14.9;
internal_r = internal_d / 2;
internal_depth = 8.5;
wall_thickness = 1.3;
chamfer = 0.4;
emboss_height = 0.7;

outer_r = internal_r + wall_thickness;
total_height = internal_depth + wall_thickness;

$fn = 120;

module cap_body() {
    difference() {
        cylinder(r=outer_r, h=total_height);
        translate([0, 0, -0.01])
            cylinder(r=internal_r, h=internal_depth + 0.01);
        translate([0, 0, -0.01])
            cylinder(r1=internal_r + chamfer, r2=internal_r, h=chamfer + 0.01);
    }
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

union() {
    cap_body();
    translate([0, 0, total_height]) savage_logo();
}
`;

(async () => {
    try {
        const instance = await createOpenSCAD();
        const stlData = await instance.renderToStl(scadCode);
        fs.writeFileSync('savage_vial_cap.stl', stlData);
        console.log('STL generated successfully.');
    } catch (err) {
        console.error("ERROR generating STL:", err);
    }
})();
