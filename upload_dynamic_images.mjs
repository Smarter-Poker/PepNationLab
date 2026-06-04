import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = 'https://ydsaqnnuwyvtyxgvrnys.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlkc2Fxbm51d3l2dHl4Z3ZybnlzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTM3OTM5MiwiZXhwIjoyMDk0OTU1MzkyfQ.M47pyCSGggSXlepDyiQaqEcU2Q3BjLHjR6p6Zqo6gqI';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const BUCKET_NAME = '15DynamicImages';
const IMAGE_DIR = path.join(process.cwd(), 'public/images/areas');

const images = [
    'pain_inflammation.png',
    'cognitive.png',
    'gut_health.png',
    'healing.png',
    'immune.png',
    'bone_joint.png',
    'longevity.png',
    'metabolic.png',
    'mitochondrial.png',
    'performance.png',
    'sexual_health.png',
    'cosmetic.png',
    'sleep.png',
    'tissue_repair.png',
    'weight_management.png'
];

async function uploadImages() {
    // 1. Create bucket if it doesn't exist
    const { data: buckets, error: bucketListErr } = await supabase.storage.listBuckets();
    if (bucketListErr) {
        console.error("Error listing buckets:", bucketListErr);
        return;
    }
    const bucketExists = buckets.find(b => b.name === BUCKET_NAME);
    
    if (!bucketExists) {
        console.log(`Creating bucket ${BUCKET_NAME}...`);
        const { error: createErr } = await supabase.storage.createBucket(BUCKET_NAME, {
            public: true,
            allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
            fileSizeLimit: 10485760 // 10MB
        });
        if (createErr) {
            console.error("Error creating bucket:", createErr);
            return;
        }
    } else {
        console.log(`Bucket ${BUCKET_NAME} already exists.`);
    }

    // 2. Upload images
    for (const image of images) {
        const filePath = path.join(IMAGE_DIR, image);
        if (fs.existsSync(filePath)) {
            const fileBuffer = fs.readFileSync(filePath);
            console.log(`Uploading ${image}...`);
            const { data, error } = await supabase.storage
                .from(BUCKET_NAME)
                .upload(image, fileBuffer, {
                    contentType: 'image/png',
                    upsert: true
                });
            if (error) {
                console.error(`Error uploading ${image}:`, error);
            } else {
                console.log(`Success: ${image}`);
            }
        } else {
            console.error(`File not found: ${filePath}`);
        }
    }
    
    console.log('All 15 images backed up to Supabase bucket: ' + BUCKET_NAME);
}

uploadImages();
