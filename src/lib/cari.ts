// Menyiapkan kata kunci pencarian agar aman dipakai pada filter PostgREST

/** Pola "mengandung kata" untuk .ilike() biasa */
export function polaMengandung(kata: string): string {
  // % dan _ adalah karakter khusus LIKE; diberi \ agar dianggap huruf biasa
  return `%${kata.trim().replace(/[\\%_]/g, '\\$&')}%`
}

/**
 * Filter "salah satu kolom mengandung kata" untuk .or().
 * Contoh: atauMengandung(['judul', 'pengarang'], 'laskar')
 */
export function atauMengandung(kolom: string[], kata: string): string {
  const pola = polaMengandung(kata)
  // nilai dibungkus tanda kutip agar koma/kurung di kata kunci tidak merusak filter
  const kutip = `"${pola.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  return kolom.map((k) => `${k}.ilike.${kutip}`).join(',')
}
