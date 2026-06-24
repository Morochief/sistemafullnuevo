import pandas as pd

df = pd.read_excel('Kevin.xlsx')

print('=== COLUMNAS ===')
print(list(df.columns))

print('\n=== PRIMERA FILA MO ===')
mo = df[df['Concepto']=='MO'].iloc[0]

cols_to_show = ['Cliente', 'Proyecto', 'Descripción', 'Hs Inicio', 'Hs Fin', 'Hs Total', 'Cantidad', 'Precio Unitario', 'Total']

for col in cols_to_show:
    valor = mo[col]
    tipo = type(valor).__name__
    print(f'{col}: {valor} (tipo: {tipo})')

print('\n=== TODAS LAS COLUMNAS DE LA PRIMERA FILA MO ===')
print(mo.to_dict())
