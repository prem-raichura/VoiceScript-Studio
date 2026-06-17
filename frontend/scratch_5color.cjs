const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, 'src');

const replacements = [
  // Backgrounds
  { regex: /bg-stone-50/g, replacement: 'bg-sand' },
  { regex: /bg-stone-100/g, replacement: 'bg-sand' },
  { regex: /bg-stone-200/g, replacement: 'bg-sand' },
  { regex: /bg-stone-300/g, replacement: 'bg-cloud' },
  { regex: /bg-stone-400/g, replacement: 'bg-cloud' },
  { regex: /bg-stone-500/g, replacement: 'bg-charcoal/60' },
  { regex: /bg-stone-800/g, replacement: 'bg-charcoal' },
  { regex: /bg-stone-900/g, replacement: 'bg-charcoal' },

  // Text
  { regex: /text-stone-50/g, replacement: 'text-sand' },
  { regex: /text-stone-100/g, replacement: 'text-sand' },
  { regex: /text-stone-400/g, replacement: 'text-charcoal/50' },
  { regex: /text-stone-500/g, replacement: 'text-charcoal/60' },
  { regex: /text-stone-600/g, replacement: 'text-charcoal/80' },
  { regex: /text-stone-700/g, replacement: 'text-charcoal/90' },
  { regex: /text-stone-800/g, replacement: 'text-charcoal' },
  { regex: /text-stone-900/g, replacement: 'text-charcoal' },

  // Borders
  { regex: /border-stone-100/g, replacement: 'border-cloud/20' },
  { regex: /border-stone-200/g, replacement: 'border-cloud/30' },
  { regex: /border-stone-300/g, replacement: 'border-cloud/50' },
  { regex: /border-stone-400/g, replacement: 'border-cloud' },
  { regex: /border-stone-500/g, replacement: 'border-charcoal/20' },

  // Brand / Accents
  { regex: /text-brand-400/g, replacement: 'text-cloud' },
  { regex: /text-brand-500/g, replacement: 'text-cloud' },
  { regex: /bg-brand-50/g, replacement: 'bg-cloud/10' },
  { regex: /border-brand-300/g, replacement: 'border-cloud/50' },
  { regex: /border-brand-400/g, replacement: 'border-cloud' },
  { regex: /border-brand-500/g, replacement: 'border-cloud' },

  // Pastels mapping (from LandingPage)
  // Rose -> Blush
  { regex: /bg-rose-50/g, replacement: 'bg-blush/20' },
  { regex: /bg-rose-100/g, replacement: 'bg-blush/40' },
  { regex: /text-rose-700/g, replacement: 'text-blush' },
  { regex: /text-rose-800/g, replacement: 'text-blush' },
  { regex: /border-rose-100/g, replacement: 'border-blush/30' },

  // Indigo / Sky -> Cloud
  { regex: /bg-indigo-50/g, replacement: 'bg-cloud/20' },
  { regex: /bg-indigo-100/g, replacement: 'bg-cloud/40' },
  { regex: /text-indigo-500/g, replacement: 'text-cloud' },
  { regex: /text-indigo-700/g, replacement: 'text-cloud' },
  { regex: /text-indigo-800/g, replacement: 'text-cloud' },
  { regex: /border-indigo-100/g, replacement: 'border-cloud/30' },
  { regex: /bg-sky-50/g, replacement: 'bg-cloud/20' },
  { regex: /text-sky-700/g, replacement: 'text-cloud' },
  { regex: /border-sky-100/g, replacement: 'border-cloud/30' },

                   
  { regex: /bg-amber-50/g, replacement: 'bg-sage/20' },
  { regex: /text-amber-500/g, replacement: 'text-sage' },
  { regex: /text-amber-700/g, replacement: 'text-sage' },
  { regex: /border-amber-100/g, replacement: 'border-sage/30' },
  { regex: /bg-emerald-50/g, replacement: 'bg-sage/20' },
  { regex: /bg-emerald-100/g, replacement: 'bg-sage/40' },
  { regex: /text-emerald-700/g, replacement: 'text-sage' },
  { regex: /text-emerald-800/g, replacement: 'text-sage' },
  { regex: /border-emerald-100/g, replacement: 'border-sage/30' },
  
  { regex: /text-green-500/g, replacement: 'text-sage' },
  { regex: /bg-green-500/g, replacement: 'bg-sage' },
  { regex: /bg-green-50/g, replacement: 'bg-sage/10' },


  { regex: /text-red-400/g, replacement: 'text-blush' },
  { regex: /text-red-500/g, replacement: 'text-blush' },
  { regex: /bg-red-50/g, replacement: 'bg-blush/20' },
  { regex: /bg-red-400/g, replacement: 'bg-blush' },
  { regex: /border-red-500/g, replacement: 'border-blush' },

  // Misc fixes
  { regex: /shadow-stone-900/g, replacement: 'shadow-charcoal' },
  { regex: /shadow-stone-400/g, replacement: 'shadow-charcoal/20' },
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js') || fullPath.endsWith('.css')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;

      for (const { regex, replacement } of replacements) {
        if (regex.test(content)) {
          content = content.replace(regex, replacement);
          modified = true;
        }
      }

      if (modified) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`Updated: ${fullPath}`);
      }
    }
  }
}

processDirectory(DIR);
console.log('5-color palette mapping complete.');
