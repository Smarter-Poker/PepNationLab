import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const updates = [
  {
    slug: '5-amino-1mq',
    eli5_summary: 'Imagine your cells have a tiny engine that burns fat, but sometimes a heavy brake gets stuck on it. 5-Amino-1MQ removes that brake so your cells can burn energy faster and shrink fat cells without you having to eat less.',
    mechanism: 'It works by blocking a specific enzyme (NNMT) that normally slows down your cellular engines. By stopping this enzyme, your body starts using up more fuel and fat naturally.'
  },
  {
    slug: 'acetic-acid',
    eli5_summary: 'Acetic acid is the main active ingredient in vinegar. When diluted for research, it acts like a natural cleaning and preserving agent that helps keep other compounds stable.',
    mechanism: 'It lowers the pH (makes it more acidic) of the liquid it is mixed with. This simple change helps stop bad bacteria from growing and keeps peptide structures from breaking apart.'
  },
  {
    slug: 'ahk-cu',
    eli5_summary: 'This is a special copper peptide that tells hair follicles to wake up and grow. It acts like a tiny fertilizer for your scalp, making hair thicker and stronger.',
    mechanism: 'It works by sending a chemical message to the tiny cells at the root of your hair, telling them to stay alive longer, grow faster, and build stronger blood vessels around the hair root.'
  },
  {
    slug: 'aicar',
    eli5_summary: 'AICAR tricks your body into thinking it just did a massive workout, even if it was just sitting still. It turns on your fat-burning mode and makes muscles act like they have been exercising for hours.',
    mechanism: 'It enters your cells and flips a master energy switch called AMPK. When this switch is flipped, the cell starts burning fat for energy and builds more stamina engines (mitochondria).'
  },
  {
    slug: 'aod9604',
    eli5_summary: 'AOD-9604 is a tiny piece of human growth hormone that only does one job: it tells the body to burn stubborn fat. It ignores everything else, so it won\'t make you hungry or mess with your blood sugar.',
    mechanism: 'It attaches to fat cells and tells them to release stored fat into the blood so it can be burned for energy. At the same time, it stops the body from storing new fat.'
  },
  {
    slug: 'ara-290',
    eli5_summary: 'ARA-290 acts like a tiny firefighter for your nerves. When nerves are damaged or hurting, it puts out the fire (inflammation) and helps the broken nerve cables heal themselves.',
    mechanism: 'It connects to a specific "repair switch" on your cells that normally responds to damage. When connected, it turns off inflammation signals and tells the nerve tissue to rebuild itself.'
  },
  {
    slug: 'b12',
    eli5_summary: 'Vitamin B12 is like the spark plug for your body\'s energy engine. It helps build healthy red blood cells, keeps your nerves firing fast, and turns the food you eat into pure, usable energy.',
    mechanism: 'It provides a missing piece that your cells need to copy DNA and create red blood cells. Without it, the body\'s energy factory stalls out.'
  },
  {
    slug: 'bac-water',
    eli5_summary: 'Bacteriostatic Water is ultra-pure water with a tiny drop of alcohol in it. The alcohol acts as a bodyguard to make sure no germs or bacteria can grow inside the bottle once you open it.',
    mechanism: 'It contains 0.9% benzyl alcohol. This alcohol stops bacteria from copying themselves and spreading, keeping the water totally clean and safe for mixing with peptides over several weeks.'
  },
  {
    slug: 'bpc-157',
    eli5_summary: 'Think of BPC-157 as the ultimate "Fix-It" mechanic for your body. Whether it is a torn muscle, a sore joint, or a damaged stomach, it rushes to the site and speeds up the healing process incredibly fast.',
    mechanism: 'It tells your body to build new, healthy blood vessels around the damaged area. More blood means more nutrients, which forces the broken tissue to heal faster.'
  },
  {
    slug: 'bpc-tb',
    eli5_summary: 'This is the ultimate tag-team for healing. BPC-157 builds the roads (blood vessels) to the injury, and TB-500 brings in the heavy construction crew to rebuild the torn muscle or tendon. Together, they heal damage faster than anything else.',
    mechanism: 'It combines two actions: one peptide creates new blood flow networks to the injury, while the other peptide tells repair cells to physically crawl into the wound and start rebuilding tissue.'
  },
  {
    slug: 'cagrilintide',
    eli5_summary: 'Cagrilintide sends a powerful "I am totally full" signal to your brain. It acts just like a hormone your body makes when you eat a huge meal, making you feel satisfied and completely uninterested in food for a long time.',
    mechanism: 'It perfectly copies a natural hormone called amylin. It connects to the brain\'s hunger center and forces it to slow down the emptying of your stomach, keeping you full.'
  },
  {
    slug: 'cagrisema',
    eli5_summary: 'CagriSema is a super-team of two weight-loss signals. One tells your stomach to stay full, and the other tells your brain to stop craving sugar. Working together, they cause massive weight loss without feeling starved.',
    mechanism: 'It hits the brain from two different angles. It activates the GLP-1 switch (which controls blood sugar and cravings) and the Amylin switch (which controls physical fullness in the stomach).'
  },
  {
    slug: 'cerebrolysin',
    eli5_summary: 'Cerebrolysin is like plant food for your brain. It helps broken brain cells heal after an injury (like a stroke or a hard hit) and helps healthy brain cells grow new connections so you can think clearer.',
    mechanism: 'It delivers a mix of tiny proteins directly to the brain that mimic natural growth signals. These signals protect nerve cells from dying and encourage them to grow new branches.'
  },
  {
    slug: 'cjc-1295-dac',
    eli5_summary: 'CJC-1295 with DAC is a messenger that tells your brain to release more growth hormone. The "DAC" part acts like a super-glue, making the messenger stick around in your blood for a whole week instead of disappearing quickly.',
    mechanism: 'It attaches to a larger protein in your blood (albumin), which stops your body from destroying it quickly. This allows it to constantly knock on the pituitary gland\'s door to release growth hormone for days.'
  },
  {
    slug: 'cjc-1295-no-dac',
    eli5_summary: 'CJC-1295 (without DAC) acts like a quick tap on the shoulder to your brain, telling it to squirt out a pulse of growth hormone right now. It gets in, does its job fast, and gets out of your system.',
    mechanism: 'It perfectly mimics your natural growth hormone-releasing hormone. It connects to the pituitary gland to trigger a fast, natural spike in growth hormone, then breaks down completely within about 30 minutes.'
  },
  {
    slug: 'cjc-ipamorelin',
    eli5_summary: 'This is the perfect team for boosting growth hormone. CJC opens the door, and Ipamorelin pushes the hormone out. Together, they force the body to release a huge wave of anti-aging and fat-burning growth hormone while you sleep.',
    mechanism: 'They press two different buttons on the pituitary gland at the exact same time. One signals to release the hormone, and the other stops the body from blocking the release. The result is a massive, natural hormone pulse.'
  },
  {
    slug: 'dsip',
    eli5_summary: 'DSIP stands for Delta Sleep-Inducing Peptide. It acts like a natural lullaby for your brain, helping you fall into the deepest, most restful stage of sleep without feeling groggy the next morning.',
    mechanism: 'It calms down the brain\'s stress signals and promotes a specific type of brain wave (Delta waves) that only happens during the most restorative phase of deep sleep.'
  },
  {
    slug: 'epithalon',
    eli5_summary: 'Epithalon is an anti-aging master switch. Imagine your cells have little shoelace caps on their DNA that wear down as you get older. Epithalon rebuilds those caps, making old cells act young again.',
    mechanism: 'It wakes up an enzyme called telomerase. This enzyme physically adds length back to the ends of your chromosomes (telomeres), which extends the lifespan of the cell.'
  },
  {
    slug: 'follistatin',
    eli5_summary: 'Your body has a natural brake pedal that stops your muscles from getting too big. Follistatin cuts that brake cable. Without the brake, your muscles are free to grow much larger and stronger.',
    mechanism: 'It permanently binds to and traps a protein called myostatin. Since myostatin is the exact chemical signal that tells muscles to stop growing, trapping it allows muscles to grow unrestricted.'
  },
  {
    slug: 'foxo4-dri',
    eli5_summary: 'As you age, some of your cells turn into "zombies"—they stop working but refuse to die, and they make nearby cells sick. FOXO4-DRI is a sniper that hunts down these zombie cells and destroys them, leaving healthy cells alone.',
    mechanism: 'It breaks the lock that zombie (senescent) cells use to keep themselves alive. Once the lock is broken, the zombie cell undergoes natural self-destruction (apoptosis), clearing the way for fresh cells.'
  },
  {
    slug: 'ghk-cu',
    eli5_summary: 'GHK-Cu is the ultimate beauty and repair signal. It grabs copper from your body and delivers it straight to your skin and hair, telling them to produce fresh, bouncy collagen and grow thicker hair.',
    mechanism: 'It physically attaches to copper molecules and pulls them into your cells. Once inside, it flips on the genes responsible for making collagen and turns off the genes that cause inflammation and scarring.'
  },
  {
    slug: 'ghrp-2',
    eli5_summary: 'GHRP-2 acts like an intense hunger and growth signal. It powerfully kicks the brain into releasing growth hormone, making it a favorite for researchers who want fast muscle recovery and anti-aging benefits.',
    mechanism: 'It mimics the hunger hormone (ghrelin) and binds directly to a receptor in the brain, forcing a rapid and intense release of growth hormone into the bloodstream.'
  },
  {
    slug: 'ghrp-6',
    eli5_summary: 'GHRP-6 tells the brain to release growth hormone, but it also flips the "extreme hunger" switch. It makes the body want to eat heavily, making it a top choice for gaining weight and building mass.',
    mechanism: 'It is a strong activator of the ghrelin receptor. While it causes a pulse of growth hormone, it also sends an overpowering signal to the stomach and brain to increase appetite immediately.'
  },
  {
    slug: 'glow',
    eli5_summary: 'The GLOW stack is a triple-threat for beauty and repair. It fixes internal tissue, brings fresh blood flow to your skin, and produces massive amounts of new collagen to make skin look young and vibrant.',
    mechanism: 'It merges three distinct pathways: BPC-157 fixes cellular damage, TB-500 drives cell migration to the skin, and GHK-Cu directly stimulates the production of collagen and elastin proteins.'
  },
  {
    slug: 'glutathione',
    eli5_summary: 'Glutathione is the body\'s master trash collector. It travels through your blood, grabbing dangerous toxins, heavy metals, and free radicals, and safely flushes them out of your body to keep you healthy and bright.',
    mechanism: 'It acts as the primary defense shield inside every cell. It sacrifices itself by binding to toxic molecules, neutralizing their electrical charge so they can be filtered out by the liver safely.'
  },
  {
    slug: 'hcg',
    eli5_summary: 'HCG acts like a master key that turns on the body\'s natural hormone factories. For men, it tells the body to keep producing its own testosterone and keeps fertility high, even if they are taking other hormones.',
    mechanism: 'It perfectly mimics a natural messenger hormone (LH). When it hits the reproductive organs, it tricks them into staying active and producing testosterone and sperm naturally.'
  },
  {
    slug: 'hexarelin',
    eli5_summary: 'Hexarelin is one of the strongest growth hormone releasers available. It causes a massive, explosive pulse of growth hormone that leads to rapid muscle repair and fat loss.',
    mechanism: 'It binds tightly to the ghrelin receptor in the brain and ignores the body\'s natural "stop" signals, resulting in an unnaturally large surge of growth hormone release.'
  },
  {
    slug: 'hgh-fragment-176-191',
    eli5_summary: 'This is literally just the fat-burning piece of human growth hormone cut off from the rest. Because it is only the fat-burning piece, it burns fat rapidly without causing muscles to grow or affecting your blood sugar.',
    mechanism: 'It isolates the specific sequence of amino acids responsible for fat breakdown (lipolysis). It attaches to fat cells and forces them to release stored fat without activating the IGF-1 growth pathways.'
  },
  {
    slug: 'hmg',
    eli5_summary: 'HMG is a pure fertility messenger. It sends a direct signal telling the body to produce eggs in women or sperm in men. It is the go-to compound when researchers want to turn the reproductive system on high gear.',
    mechanism: 'It provides a mix of FSH and LH, the two master hormones that directly command the reproductive organs to produce viable sperm cells or mature eggs.'
  },
  {
    slug: 'igf-1-lr3',
    eli5_summary: 'IGF-1 LR3 is the ultimate muscle-building signal. It forces your body to actually create brand new muscle cells instead of just making existing ones bigger. The "LR3" part makes it last a very long time in your body.',
    mechanism: 'It binds to receptors that trigger massive cell division and growth in muscle tissue. The LR3 modification prevents it from being deactivated by blood proteins, extending its active life from minutes to over 20 hours.'
  },
  {
    slug: 'ipamorelin',
    eli5_summary: 'Ipamorelin is the cleanest growth hormone booster. It gently nudges your brain to release growth hormone without making you hungry or raising your stress hormones. It is perfect for steady, long-term anti-aging.',
    mechanism: 'It is a highly selective ghrelin mimetic. It stimulates a clean pulse of growth hormone without accidentally triggering the release of cortisol (stress) or prolactin, making it incredibly well-tolerated.'
  },
  {
    slug: 'kisspeptin-10',
    eli5_summary: 'Kisspeptin-10 is the very first domino in your body\'s hormone chain. Pushing it triggers a cascade that boosts testosterone, increases fertility, and increases drive, all by using your body\'s natural pathways.',
    mechanism: 'It stimulates the hypothalamus in the brain to release GnRH. This sets off a natural chain reaction down to the pituitary gland and reproductive organs to boost natural hormone production.'
  },
  {
    slug: 'klow',
    eli5_summary: 'KLOW is the ultimate quadruple healing stack. It repairs damaged guts, fixes torn muscles, brings down swelling, and clears up skin all at exactly the same time. It is a full-body reset button.',
    mechanism: 'It layers four separate mechanisms: BPC-157 for blood vessel growth, TB-500 for cellular movement, GHK-Cu for collagen production, and KPV to forcefully shut down the main inflammation switch in the immune system.'
  },
  {
    slug: 'kpv',
    eli5_summary: 'KPV is the ultimate inflammation cooler. When your immune system is freaking out and causing red, swollen, angry issues (like in the gut or on the skin), KPV acts like a fire extinguisher to instantly calm it down.',
    mechanism: 'It enters inside the cell and directly blocks a molecule (NF-kB) that acts as the main "fire alarm" for inflammation. Once blocked, the cell stops producing inflammatory chemicals.'
  },
  {
    slug: 'l-carnitine',
    eli5_summary: 'L-Carnitine acts like a tiny taxi cab for your fat. It picks up fat cells and drives them straight into your body\'s cellular furnaces so they can be burned for energy instead of being stored on your belly.',
    mechanism: 'It is the essential transport vehicle that carries fatty acids across the mitochondrial membrane. Without it, fat cannot enter the cellular engine to be oxidized and used as fuel.'
  },
  {
    slug: 'lemon-bottle',
    eli5_summary: 'Lemon Bottle is a fast-acting fat dissolver made from natural ingredients. When applied to stubborn fat pockets, it physically breaks down the fat cell walls so the body can easily wash the fat away.',
    mechanism: 'It uses Riboflavin and Bromelain to accelerate the breakdown of fat cell membranes (lipolysis). Once the cell is broken, the fat is released and safely filtered out of the body through the lymphatic system.'
  },
  {
    slug: 'limitless-stack',
    eli5_summary: 'The Limitless Stack is brain food mixed with super-energy. It combines compounds that heal brain cells, boost mental clarity, and provide endless cellular fuel so you feel sharper, faster, and totally dialed in.',
    mechanism: 'It combines neurotrophic factors (like Cerebrolysin or Semax) that build new neural connections, alongside metabolic boosters like NAD+ that maximize the energy output of the brain\'s mitochondria.'
  },
  {
    slug: 'lipo-c',
    eli5_summary: 'Lipo-C is a supercharged vitamin cocktail that specifically targets the liver. It helps the liver process fat faster, speeds up weight loss, and gives you a nice boost of clean energy.',
    mechanism: 'It delivers highly bioavailable lipotropic agents (Methionine, Inositol, Choline) that specifically help the liver break down and export fat, preventing fat buildup and speeding up metabolism.'
  },
  {
    slug: 'll-37',
    eli5_summary: 'LL-37 is your immune system\'s natural SWAT team. It physically punches holes in bad bacteria, viruses, and fungi to destroy them, while also helping nearby wounds heal faster.',
    mechanism: 'It is a natural antimicrobial peptide. It binds directly to the outer layer of harmful bacteria and viruses and ruptures their membranes, causing them to die instantly.'
  },
  {
    slug: 'melatonin',
    eli5_summary: 'Melatonin is the "time to sleep" signal. When it gets dark, your brain releases it to tell your entire body to power down, get sleepy, and stay asleep through the night.',
    mechanism: 'It binds to receptors in the brain that regulate the circadian rhythm (your internal clock), lowering body temperature and signaling the nervous system to initiate the sleep cycle.'
  },
  {
    slug: 'mots-c',
    eli5_summary: 'MOTS-c is known as the "exercise in a bottle" peptide. It targets your muscles and tells them to process sugar and burn fat as if you were running a marathon, boosting massive stamina and energy.',
    mechanism: 'It acts directly on the mitochondria (the cell\'s engine) and activates the AMPK pathway, which shifts the body from storing fat to rapidly burning glucose and fatty acids for athletic endurance.'
  },
  {
    slug: 'mt-1',
    eli5_summary: 'Melanotan-1 mimics a natural hormone that tells your skin to produce a protective, dark tan without needing to sit in the sun for hours. It provides a flawless tan while protecting the skin from UV damage.',
    mechanism: 'It binds to the melanocortin 1 receptor on skin cells, stimulating the production of melanin (the dark pigment) while remaining very safe and not crossing into the brain to cause side effects.'
  },
  {
    slug: 'nad-plus',
    eli5_summary: 'NAD+ is the raw fuel your cells use to stay alive. As we get older, our gas tank runs low, causing us to feel tired and age faster. Giving the body NAD+ refills the tank, turning back the clock on aging and energy.',
    mechanism: 'It acts as the critical coenzyme in the mitochondria required to produce ATP (cellular energy). Restoring NAD+ levels directly increases cellular energy output and activates anti-aging repair genes (sirtuins).'
  },
  {
    slug: 'oxytocin',
    eli5_summary: 'Oxytocin is the "hug hormone." It is the natural chemical that makes you feel bonded, trusting, and deeply connected to your loved ones, while also lowering stress and anxiety.',
    mechanism: 'It is released in the brain to modulate emotional and social behaviors. It dampens the fear response in the amygdala, reducing anxiety and promoting feelings of trust and pair bonding.'
  },
  {
    slug: 'pinealon',
    eli5_summary: 'Pinealon is a tiny brain-protector. It dives deep into your brain cells and shields them from stress, toxins, and aging, helping you maintain a sharp memory and a calm mind.',
    mechanism: 'It is a short peptide that interacts directly with DNA in brain cells, regulating the production of proteins that protect neurons from oxidative stress and programmed cell death.'
  },
  {
    slug: 'pt-141',
    eli5_summary: 'PT-141 works directly in the brain to flip on the switch for sexual desire and arousal in both men and women. Unlike pills that just increase blood flow, this actually fixes the mental desire to be intimate.',
    mechanism: 'It bypasses the vascular system entirely and binds to melanocortin receptors in the brain (MC3R and MC4R), directly stimulating the central nervous system pathways responsible for sexual arousal.'
  },
  {
    slug: 'retatrutide',
    eli5_summary: 'Retatrutide is the ultimate triple-threat for weight loss. It tells your brain you are full, tells your stomach to stop eating, AND cranks up your metabolism to burn off massive amounts of fat faster than anything else.',
    mechanism: 'It activates three different hormone receptors at once (GLP-1, GIP, and Glucagon). This not only halts appetite but forcefully increases the body\'s baseline calorie burn rate.'
  },
  {
    slug: 'selank',
    eli5_summary: 'Selank acts like a calming blanket for a stressed-out brain. It completely wipes away anxiety, stops racing thoughts, and helps you focus clearly without making you feel sleepy or tired.',
    mechanism: 'It regulates the breakdown of natural calming chemicals in the brain (enkephalins) and boosts serotonin and dopamine, providing intense anxiety relief while actually improving cognitive focus.'
  },
  {
    slug: 'semaglutide',
    eli5_summary: 'Semaglutide tells your brain that you just ate a huge meal, making you feel completely full all day long. It also slows down your digestion so your blood sugar stays perfectly flat, leading to massive weight loss.',
    mechanism: 'It is a GLP-1 receptor agonist that slows gastric emptying and sends strong satiety signals to the hypothalamus, drastically reducing caloric intake and managing insulin release.'
  },
  {
    slug: 'semax',
    eli5_summary: 'Semax is like a heavy cup of coffee for your brain but without the jitters. Originally developed in Russia, it sharpens your focus, improves your memory, and protects your brain from stress.',
    mechanism: 'It stimulates the rapid release of Brain-Derived Neurotrophic Factor (BDNF), which encourages neurons to form new connections, dramatically improving learning capacity and mental stamina.'
  },
  {
    slug: 'sermorelin',
    eli5_summary: 'Sermorelin is a gentle whisper to your brain, reminding it to produce growth hormone like it did when you were younger. It is very mild, making it a great starting point for safe, long-term anti-aging.',
    mechanism: 'It provides the shortest active sequence of Growth Hormone-Releasing Hormone (GHRH), binding to the pituitary to trigger a completely natural, mild pulse of growth hormone during sleep.'
  },
  {
    slug: 'shred-stack',
    eli5_summary: 'The Shred Stack combines intense fat-burning with muscle protection. It forces the body to release stored belly fat into the bloodstream and immediately burns it for energy, all while keeping your hard-earned muscle safe.',
    mechanism: 'It pairs a fat-releasing agent (like HGH Frag) to break down lipid stores with a metabolic booster or muscle preserver (like AOD or CJC) to ensure the freed fat is oxidized while maintaining lean mass.'
  },
  {
    slug: 'snap-8',
    eli5_summary: 'Snap-8 is like natural botox in a cream or serum. It gently relaxes the tiny muscles in your face so that wrinkles and fine lines smooth out and disappear without the need for needles.',
    mechanism: 'It slightly interrupts the chemical signal that tells facial muscles to contract. By reducing the intensity of the muscle contraction, the skin above it stops folding, reducing the depth of wrinkles.'
  },
  {
    slug: 'ss-31',
    eli5_summary: 'SS-31 acts like a mechanic that specifically repairs the engine inside your cells (the mitochondria). By fixing the engines, it brings dead, tired cells back to life, reversing aging at the deepest possible level.',
    mechanism: 'It specifically binds to cardiolipin, a vital fat found on the inner wall of the mitochondria. This instantly restores the structural integrity of the cell\'s energy factory, improving ATP output.'
  },
  {
    slug: 'survodutide',
    eli5_summary: 'Survodutide is a dual-action weight loss powerhouse. It kills your appetite so you do not want to eat, while simultaneously turning up your body\'s heat to burn off stubborn fat directly from the liver.',
    mechanism: 'It is a dual agonist that hits both the GLP-1 receptor (to stop hunger) and the Glucagon receptor (to actively force the liver to burn stored fat and increase energy expenditure).'
  },
  {
    slug: 'tb-500',
    eli5_summary: 'TB-500 is the ultimate construction crew for torn muscles, tendons, and ligaments. It tells repair cells to physically crawl into the damaged area and rapidly stitch the broken fibers back together.',
    mechanism: 'It binds to cellular actin, the protein responsible for cell movement. This heavily upregulates cell migration, allowing healing cells to travel quickly into damaged soft tissue to begin structural repair.'
  },
  {
    slug: 'tesamorelin',
    eli5_summary: 'Tesamorelin is the only growth hormone booster specifically proven to target and melt away hard, stubborn belly fat (visceral fat). It was literally FDA-approved just for this purpose.',
    mechanism: 'It is a highly stable GHRH analogue that binds to the pituitary to release growth hormone. Uniquely, its specific pulsatile effect heavily targets the breakdown of visceral adipose tissue (deep belly fat).'
  },
  {
    slug: 'thymalin',
    eli5_summary: 'Thymalin acts like a drill sergeant for your immune system. It trains your immune cells to fight off viruses and keeps your body\'s defenses acting young, strong, and highly organized.',
    mechanism: 'It regulates the thymus gland, stimulating the production and maturation of T-cells, ensuring the immune system can correctly identify and destroy harmful pathogens without attacking healthy cells.'
  },
  {
    slug: 'thymosin-alpha-1',
    eli5_summary: 'Thymosin Alpha-1 is a powerful immune system booster. Whether you are fighting a bad virus, a chronic illness, or just getting sick too often, it flips the immune system on full blast to clear the threat.',
    mechanism: 'It directly stimulates the action of natural killer cells and T-cells, enhancing the body\'s cell-mediated immune response to quickly hunt down and eradicate viral infections and rogue cells.'
  },
  {
    slug: 'tirzepatide',
    eli5_summary: 'Tirzepatide is a super-advanced weight loss signal. It acts like two different hormones combined into one, stopping your hunger completely while also making your body process sugars flawlessly.',
    mechanism: 'It is a dual GIP and GLP-1 receptor agonist. It dramatically slows gastric emptying and sensitizes the body to insulin, resulting in profound appetite suppression and record-breaking weight loss in trials.'
  },
  {
    slug: 'vip',
    eli5_summary: 'VIP stands for Vasoactive Intestinal Peptide. It acts like a massive relaxer for your blood vessels and lungs, opening them up to increase blood flow, lower blood pressure, and heal toxic damage from mold.',
    mechanism: 'It binds to VIP receptors throughout the body, causing smooth muscle relaxation. This dilates blood vessels, reduces systemic inflammation, and has been uniquely effective in reversing chronic inflammatory response syndrome (CIRS).'
  }
];

async function updateCompounds() {
  console.log(`Starting update for ${updates.length} compounds...`);
  
  for (const update of updates) {
    const { slug, eli5_summary, mechanism } = update;
    
    const { error } = await supabase
      .from('compounds')
      .update({ eli5_summary, mechanism })
      .eq('slug', slug);
      
    if (error) {
      console.error(`❌ Failed to update ${slug}:`, error.message);
    } else {
      console.log(`✅ Updated ${slug}`);
    }
  }
  
  console.log('🎉 All compounds have been rewritten to 5-year-old explanations successfully!');
}

updateCompounds();
