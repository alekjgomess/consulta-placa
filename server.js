import 'dotenv/config';
import express from 'express';
import { buscarProdutos, listar, criar, remover } from './db.js';

const { WDAPI_TOKEN, ADMIN_KEY, MOCK, PORT = 3000 } = process.env;
const app = express();
app.use(express.json());
app.use(express.static('public'));

const MOCK_DATA = {
  marca: 'HYUNDAI', modelo: 'HB20 1.0M COMFOR', cor: 'BRANCA', ano: '2014', anoModelo: '2015',
  extra: { combustivel: 'Alcool / Gasolina', ano_fabricacao: '2014', ano_modelo: '2015' },
  logo: 'https://apiplacas.com.br/logos/logosMarcas/hyundai.png'
};

// A API não informa o tipo de câmbio: deduzimos pelo texto do modelo.
function detectarCambio(d) {
  const t = [d.modelo, ...(d.fipe?.dados || []).map(x => x.texto_modelo)].join(' ').toUpperCase();
  if (/\bAUT\b|\bAUT\.|\d\.\dA\b|AUTOM/.test(t)) return 'Automático';
  if (/\bMEC\b|\bMEC\.|\d\.\dM\b|MANUAL/.test(t)) return 'Manual';
  return 'Não informado';
}

function normalizar(d, placa) {
  const e = d.extra || {};
  return {
    placa,
    marca: (d.marca || '').toUpperCase(),
    modelo: d.modelo || '',
    cor: d.cor || '',
    anoFabricacao: Number(e.ano_fabricacao || d.ano) || null,
    anoModelo: Number(e.ano_modelo || d.anoModelo) || null,
    cambio: detectarCambio(d),
    combustivel: e.combustivel || '',
    municipio: d.municipio || '',
    logo: d.logo || ''
  };
}

app.get('/api/consulta/:placa', async (req, res) => {
  const placa = req.params.placa.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!/^[A-Z]{3}\d[A-Z0-9]\d{2}$/.test(placa)) return res.status(400).json({ erro: 'Placa inválida.' });
  try {
    let d = MOCK_DATA;
    if (MOCK !== '1') {
      if (!WDAPI_TOKEN) throw new Error('WDAPI_TOKEN não configurado no .env');
      const r = await fetch(`https://wdapi2.com.br/consulta/${placa}/${WDAPI_TOKEN}`);
      if (!r.ok) throw new Error(`A API de placas respondeu ${r.status}`);
      d = await r.json();
    }
    if (!d.marca) return res.status(404).json({ erro: d.mensagemRetorno || 'Placa não encontrada.' });
    const veiculo = normalizar(d, placa);
    const produtos = buscarProdutos({ marca: veiculo.marca, modelo: veiculo.modelo, ano: veiculo.anoModelo || veiculo.anoFabricacao });
    res.json({ veiculo, produtos });
  } catch (e) {
    res.status(502).json({ erro: e.message });
  }
});

// ---- Gestão do catálogo (protegida por ADMIN_KEY) ----
const auth = (req, res, next) =>
  ADMIN_KEY && req.get('x-admin-key') === ADMIN_KEY ? next() : res.status(401).json({ erro: 'Chave de admin inválida.' });

app.get('/api/produtos', auth, (_, res) => res.json(listar()));
app.post('/api/produtos', auth, (req, res) => {
  const b = req.body, f = ['marca', 'modelo', 'ano_de', 'ano_ate', 'categoria', 'referencia'];
  if (f.some(k => !b[k])) return res.status(400).json({ erro: 'Preencha todos os campos obrigatórios.' });
  criar({ marca: String(b.marca).toUpperCase(), modelo: String(b.modelo).toUpperCase(),
          ano_de: +b.ano_de, ano_ate: +b.ano_ate, categoria: b.categoria, referencia: b.referencia, observacao: b.observacao || null });
  res.status(201).json({ ok: true });
});
app.delete('/api/produtos/:id', auth, (req, res) => { remover(+req.params.id); res.json({ ok: true }); });

app.listen(PORT, () => console.log(`Catálogo rodando em http://localhost:${PORT}`));
