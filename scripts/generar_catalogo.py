import pandas as pd
import json

# Leer Excel
df = pd.read_excel("scripts/Localidad CUSCO.xlsx")

# Quitar espacios
df.columns = df.columns.str.strip()

# Ordenar
df = df.sort_values(["NOM_MUN", "NOMGEO"])

catalogo = {}

for _, fila in df.iterrows():

    municipio = fila["NOM_MUN"]
    localidad = fila["NOMGEO"]

    registro = {
        "nombre": localidad,
        "cvegeo": str(fila["CVEGEO"]).zfill(9),
        "jurisdiccion": fila["Jurisdicción"]
    }

    if municipio not in catalogo:
        catalogo[municipio] = []

    catalogo[municipio].append(registro)

# Crear archivo JS
with open("catalogo_localidades.js", "w", encoding="utf-8") as f:

    f.write("var LOCALIDADES_CUSCO = ")
    json.dump(
        catalogo,
        f,
        ensure_ascii=False,
        indent=2
    )
    f.write(";")

print("Archivo catalogo_localidades.js generado correctamente.")