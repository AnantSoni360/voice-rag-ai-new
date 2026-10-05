import sys

file_path = r"C:\Users\Acer\AppData\Local\Programs\Python\Python312\Lib\site-packages\faster_whisper\audio.py"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace(', metadata_errors="ignore"', '')

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("Patched successfully!")
