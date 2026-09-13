/**
 * Los 22 departamentos de Guatemala -- lista cerrada real, no un dato
 * inventado. Antes "Departamento / estado" era texto libre y aceptaba
 * cualquier cosa (ej. "huehue", "sadasf"); con esto se reemplaza por un
 * selector, así ni siquiera es posible guardar un valor que no sea un
 * departamento real. El campo sigue siendo opcional -- lo que deja de
 * ser posible es guardarlo con basura si SÍ se completa.
 */
export const GUATEMALA_DEPARTMENTS = [
  "Alta Verapaz",
  "Baja Verapaz",
  "Chimaltenango",
  "Chiquimula",
  "El Progreso",
  "Escuintla",
  "Guatemala",
  "Huehuetenango",
  "Izabal",
  "Jalapa",
  "Jutiapa",
  "Petén",
  "Quetzaltenango",
  "Quiché",
  "Retalhuleu",
  "Sacatepéquez",
  "San Marcos",
  "Santa Rosa",
  "Sololá",
  "Suchitepéquez",
  "Totonicapán",
  "Zacapa",
] as const;

export type GuatemalaDepartment = (typeof GUATEMALA_DEPARTMENTS)[number];

/** Código postal de Guatemala: 5 dígitos numéricos (ej. "01001"). */
export const POSTAL_CODE_PATTERN = /^\d{5}$/;
