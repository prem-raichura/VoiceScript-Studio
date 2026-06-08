import os
import glob
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Replacements for elegant frost mode
    replacements = [
        (r'bg-orange-400/30', 'bg-indigo-500/10'),
        (r'bg-rose-400/20', 'bg-violet-500/10'),
        (r'bg-yellow-400/30', 'bg-sky-500/10'),
        (r'text-rose-500', 'text-indigo-600'),
        (r'border-rose-200', 'border-indigo-200'),
        (r'bg-rose-50/80', 'bg-indigo-50/80'),
        (r'text-orange-500', 'text-indigo-600'),
        (r'border-orange-200', 'border-slate-200'),
        (r'bg-orange-50', 'bg-slate-50'),
        (r'bg-orange-100', 'bg-slate-100'),
        (r'text-orange-700', 'text-slate-700'),
        (r'text-orange-600', 'text-slate-600'),
        (r'from-orange-100/60 to-white/80', 'from-indigo-50/60 to-white/80'),
        (r'from-orange-400 to-rose-400', 'from-indigo-500 to-violet-500'),
        (r'bg-red-500/10', 'bg-red-50'),
        (r'border-red-500/30', 'border-red-200'),
        (r'bg-red-500/20', 'bg-red-100'),
        (r'text-gray-900', 'text-slate-900'),
        (r'text-gray-800', 'text-slate-800'),
        (r'text-gray-700', 'text-slate-700'),
        (r'text-gray-600', 'text-slate-500'),
        (r'text-gray-500', 'text-slate-400'),
    ]

    new_content = content
    for pattern, repl in replacements:
        new_content = new_content.replace(pattern, repl)

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

for root, _, files in os.walk('/Users/premraichura/Study/Projects/Live audio to test conversion/frontend/src'):
    for file in files:
        if file.endswith('.jsx'):
            process_file(os.path.join(root, file))
