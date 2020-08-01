#!/usr/bin/env python3
import re

def new_class(name, body):
    new_name = name[0].upper() + name[1:]
    
    new_body = body.replace("this.memory", "memory").replace("this.", "cpu.")
    new_body = re.sub(r"memory\[([^\]]+)\]", r"memory.getByte(\1)", new_body)
    new_body = new_body.replace("byte", "memory.getByte(this.address)")
    new_body = re.sub(r"memory\.getByte\(([^\)]*)\) = (.*);", r"memory.setByte(\1, \2);", new_body)
        
    print('''
export class {new_name} extends Instruction {{
  size() {{
    return 0; // TODO
  }}

  exec(cpu: CPU, memory: Memory) {{
{new_body}
  }}

  disassemble(memory: Memory) {{
    return `TODO`;
  }}
}}
'''.format(new_name=new_name, new_body=new_body))

with open('src/cpu.ts', 'r') as f:
    fn_body = ''
    fn_name = None
    fn_regex = re.compile(r"  (.*)\(")
    for line in f.readlines():
        if fn_name:
            if line == '  }\n':
                new_class(fn_name, fn_body)
                fn_name = None
                fn_body = ''
            else:
                fn_body += line
        elif line.startswith('  op'):
            in_fn = True
            matches = fn_regex.match(line)
            fn_name = matches.group(1)
