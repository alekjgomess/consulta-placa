import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('catalogo.db');
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS compatibilidades (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  marca      TEXT NOT NULL,
  modelo     TEXT NOT NULL,
  ano_de     INTEGER NOT NULL,
  ano_ate    INTEGER NOT NULL,
  categoria  TEXT NOT NULL,
  referencia TEXT NOT NULL,
  observacao TEXT
);
CREATE INDEX IF NOT EXISTS idx_marca_modelo ON compatibilidades (marca, modelo);
`);

// Carga inicial (só roda se a tabela estiver vazia)
if (db.prepare('SELECT COUNT(*) AS n FROM compatibilidades').get().n === 0) {
  const ins = db.prepare(`INSERT INTO compatibilidades
    (marca, modelo, ano_de, ano_ate, categoria, referencia, observacao)
    VALUES (@marca, @modelo, @ano_de, @ano_ate, @categoria, @referencia, @observacao)`);
  const base = { marca: 'HYUNDAI', modelo: 'HB20', ano_de: 2012, ano_ate: 2019 };
  [
    { categoria: 'Palheta lado motorista', referencia: 'A24' },
    { categoria: 'Palheta lado carona', referencia: 'A16' },
    { categoria: 'Óleo do motor', referencia: '5W30', observacao: 'Sintético' },
    { categoria: 'Filtro de óleo', referencia: 'JFO0H00' }
  ].forEach(p => ins.run({ observacao: null, ...base, ...p }));
}

export function buscarProdutos({ marca, modelo, ano }) {
  return db.prepare(`
    SELECT id, categoria, referencia, observacao FROM compatibilidades
    WHERE UPPER(marca) = UPPER(?)
      AND instr(UPPER(?), UPPER(modelo)) > 0
      AND ? BETWEEN ano_de AND ano_ate
    ORDER BY categoria`).all(marca, modelo, ano ?? 0);
}
export const listar = () => db.prepare('SELECT * FROM compatibilidades ORDER BY id DESC LIMIT 100').all();
export const criar = p => db.prepare(`INSERT INTO compatibilidades
  (marca, modelo, ano_de, ano_ate, categoria, referencia, observacao)
  VALUES (@marca, @modelo, @ano_de, @ano_ate, @categoria, @referencia, @observacao)`).run(p);
export const remover = id => db.prepare('DELETE FROM compatibilidades WHERE id = ?').run(id);