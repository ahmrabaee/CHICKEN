import os
import re

src_dir = r"c:\Users\ibrahem-pc\OneDrive\Desktop\fuck\CHICKEN\app\frontend\src"

# Match <Input ... type="number" ... > (supporting multiline)
input_regex = re.compile(r'<Input\b([^>]*?)type="number"([^>]*?)>', re.DOTALL)
# Match the import statement to insert NumericInput after it
import_regex = re.compile(r'(import \{[^}]*Input[^}]*\} from "@/components/ui/input";?)')

modified_files = []

for root, _, files in os.walk(src_dir):
    for file in files:
        if file.endswith('.tsx'):
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            if 'type="number"' in content and '<Input' in content:
                new_content, count = input_regex.subn(r'<NumericInput\1\2>', content)
                
                if count > 0:
                    # check if already imported
                    if 'import { NumericInput }' not in new_content:
                        # add import
                        new_content = import_regex.sub(r'\1\nimport { NumericInput } from "@/components/ui/numeric-input";', new_content, count=1)

                    # write back
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(new_content)
                    modified_files.append(filepath)

print(f"Modified {len(modified_files)} files:")
for f in modified_files:
    print(f)
