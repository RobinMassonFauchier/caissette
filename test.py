import sys
import pytesseract
import cv2
import gspread
from pdf2image import convert_from_path

print("--- RAPPORT DE VÉRIFICATION ---")

# 1. Test Python
print(f"✅ Python est bien installé (Version {sys.version.split()[0]})")

# 2. Test Tesseract
# Note : Modifiez le chemin ci-dessous si vous l'avez installé ailleurs
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
try:
    v = pytesseract.get_tesseract_version()
    print(f"✅ Tesseract OCR est détecté (Version {v})")
except:
    print("❌ Tesseract n'est pas trouvé. Vérifiez le chemin d'installation.")

# 3. Test Bibliothèques
print("✅ Bibliothèques OpenCV et Gspread chargées avec succès")

# 4. Test Fichier Identifiants
import os
if os.path.exists("credentials.json"):
    print("✅ Fichier 'credentials.json' détecté dans le dossier")
else:
    print("⚠️ Fichier 'credentials.json' absent (nécessaire pour Google Sheets)")

print("-------------------------------")