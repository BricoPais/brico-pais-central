import React, { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  Truck,
  Receipt,
  PackageCheck,
  Plus,
  Trash2,
  Loader2,
  X,
  AlertCircle,
  Smartphone,
  LogOut,
  Check,
  MapPin,
  Pencil,
} from "lucide-react";
import { supabase } from "./supabaseClient";

// ---------------------------------------------------------------------
// MARCA — cores reais extraídas do logótipo da Brico Pais
// ---------------------------------------------------------------------
const BRAND = {
  ink: "#141414",
  inkSoft: "#6B615C",
  maroon: "#601B1E",
  maroonDark: "#450F12",
  maroonSoft: "#8A4245",
  amber: "#C98A2C",
  green: "#3F8F5B",
  paper: "#F7F5F2",
  white: "#FFFFFF",
  line: "#E4DEDA",
};

const PLACAS = ["AE-44-HF", "BP-96-AJ", "36-TS-97", "45-77AU", "49-02-CQ", "95-59-UT"];

// ---- Configuração de cada quadro (mapeada para as tabelas da Supabase) ----
const BOARDS = {
  orcamentos: {
    table: "orcamentos",
    label: "Orçamentos",
    icon: ClipboardList,
    estados: ["Novo", "Em resposta", "Enviado ao cliente", "Fechado"],
    estadoCor: {
      Novo: BRAND.maroon,
      "Em resposta": BRAND.amber,
      "Enviado ao cliente": BRAND.maroonSoft,
      Fechado: BRAND.green,
    },
    fields: [
      { name: "cliente", label: "Cliente", type: "text", required: true },
      { name: "contacto", label: "Contacto", type: "text" },
      { name: "pedido", label: "O que pediu", type: "textarea", required: true },
    ],
  },
  fornecedores: {
    table: "fornecedores",
    label: "Fornecedores",
    icon: Truck,
    estados: ["Pedido enviado", "Confirmado", "A caminho", "Entregue"],
    estadoCor: {
      "Pedido enviado": BRAND.maroon,
      Confirmado: BRAND.amber,
      "A caminho": BRAND.maroonSoft,
      Entregue: BRAND.green,
    },
    fields: [
      { name: "fornecedor", label: "Fornecedor / marca", type: "text", required: true },
      { name: "produto", label: "Produto", type: "text", required: true },
      { name: "cliente_destino", label: "Cliente de destino", type: "text" },
      { name: "prazo", label: "Prazo previsto", type: "text" },
    ],
  },
  faturas: {
    table: "faturas",
    label: "Faturação",
    icon: Receipt,
    estados: ["Pendente", "Pago", "Atrasado"],
    estadoCor: {
      Pendente: BRAND.amber,
      Pago: BRAND.green,
      Atrasado: BRAND.maroonDark,
    },
    fields: [
      { name: "cliente", label: "Cliente", type: "text", required: true },
      { name: "valor", label: "Valor (€)", type: "number", required: true },
      { name: "vencimento", label: "Data de vencimento", type: "date" },
    ],
  },
  entregas: {
    table: "entregas",
    label: "Entregas",
    icon: PackageCheck,
    editableCard: true,
    estados: ["Por carregar", "Carregada", "Entregue"],
    estadoCor: {
      "Por carregar": BRAND.maroon,
      Carregada: BRAND.amber,
      Entregue: BRAND.green,
    },
    fields: [
      { name: "cliente", label: "Cliente", type: "text", required: true },
      { name: "veiculo", label: "Viatura (matrícula)", type: "select", options: PLACAS, required: true },
      { name: "carga", label: "O que carregar", type: "textarea", required: true },
      { name: "morada", label: "Local de descarga (descrição)", type: "text", required: true },
      { name: "maps_link", label: "Link do Google Maps / coordenadas (opcional)", type: "text", hidden: true },
      { name: "data_prevista", label: "Data e hora previstas", type: "datetime-local" },
      { name: "responsavel_id", label: "Motorista", type: "motorista-select" },
      { name: "obs", label: "Observações do escritório", type: "textarea" },
    ],
  },
};

const DONE_STATES = ["Fechado", "Entregue", "Pago"];

// ---------------------------------------------------------------------
// AUXILIARES DE DATA E MAPA
// ---------------------------------------------------------------------
function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleString("pt-PT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function mapsLink(morada) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(morada)}&travelmode=driving`;
}

function extractLatLng(text) {
  if (!text) return null;
  const match = text.match(/(-?\d{1,3}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (match) return `${match[1]},${match[2]}`;
  return null;
}

function buildAppMapsHref(item) {
  const link = (item.maps_link || "").trim();
  const coords = extractLatLng(link);
  const destino = coords || item.morada || "";
  const destinoEncoded = encodeURIComponent(destino);
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  if (isAndroid) return `geo:0,0?q=${destinoEncoded}`;
  if (isIOS) return `comgooglemaps://?daddr=${destinoEncoded}&directionsmode=driving`;
  return null;
}

function buildWebMapsHref(item) {
  const link = (item.maps_link || "").trim();
  const coords = extractLatLng(link);
  const isUrl = /^https?:\/\//i.test(link);
  if (isUrl && !coords) return link;
  return mapsLink(coords || item.morada || "");
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Converte campos vazios ("") em null antes de gravar — necessário para
// campos como o motorista (uuid), que rebentam se receberem texto vazio.
function sanitize(values) {
  const out = {};
  for (const k in values) {
    out[k] = values[k] === "" ? null : values[k];
  }
  return out;
}

// ---------------------------------------------------------------------
// COMPONENTES PARTILHADOS
// ---------------------------------------------------------------------
function Logo({ height = 40 }) {
  return <img src="/logo.png" alt="Brico Pais — João Pais & Filhas, Lda." style={{ height, width: "auto" }} />;
}

function StatusPill({ estado, cor }) {
  return (
    <span
      className="text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap"
      style={{ backgroundColor: cor + "1A", color: cor, border: `1px solid ${cor}55` }}
    >
      {estado}
    </span>
  );
}

function MapsButtons({ item, compact }) {
  const appHref = buildAppMapsHref(item);
  const webHref = buildWebMapsHref(item);
  return (
    <div className="flex flex-col gap-1">
      <a
        href={appHref || webHref}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-1.5 font-semibold w-fit rounded-md ${compact ? "text-xs mt-1" : "text-sm px-3 py-1.5"}`}
        style={compact ? { color: BRAND.maroon } : { backgroundColor: BRAND.maroon + "12", color: BRAND.maroon }}
      >
        <MapPin size={compact ? 12 : 14} /> Abrir no Google Maps
      </a>
      {appHref && (
        <a href={webHref} target="_blank" rel="noopener noreferrer" className="text-xs underline w-fit" style={{ color: BRAND.inkSoft }}>
          Não abriu? Tentar no navegador
        </a>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// LOGIN — Supabase Auth (email + palavra-passe reais)
// ---------------------------------------------------------------------
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);

  const entrar = async () => {
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setErro("");
    const email = username.includes("@") ? username.trim() : `${username.trim().toLowerCase()}@bricopais.pt`;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setErro("Utilizador ou palavra-passe incorretos.");
      setLoading(false);
      return;
    }
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();
    if (profileError || !profile) {
      setErro("Login feito, mas não encontrei o seu perfil. Fale com quem gere o sistema.");
      setLoading(false);
      return;
    }
    setLoading(false);
    onLogin(profile);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: BRAND.paper }}>
      <Logo height={56} />
      <h1 className="text-xl font-bold mt-6 mb-1" style={{ color: BRAND.ink }}>
        Central de Operações
      </h1>
      <p className="text-sm mb-8 text-center max-w-xs" style={{ color: BRAND.inkSoft }}>
        Inicie sessão para continuar.
      </p>

      <div className="w-full max-w-xs px-5 py-5 rounded-lg flex flex-col gap-3" style={{ backgroundColor: BRAND.white, border: `1px solid ${BRAND.line}` }}>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND.inkSoft }}>
            Utilizador
          </label>
          <input
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
            autoFocus
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setErro("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") entrar();
            }}
            className="border rounded-md px-3 py-2 text-sm"
            style={{ borderColor: erro ? BRAND.maroonDark : BRAND.line }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND.inkSoft }}>
            Palavra-passe
          </label>
          <input
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setErro("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") entrar();
            }}
            className="border rounded-md px-3 py-2 text-sm tracking-widest"
            style={{ borderColor: erro ? BRAND.maroonDark : BRAND.line }}
          />
        </div>

        {erro && (
          <span className="text-xs" style={{ color: BRAND.maroonDark }}>
            {erro}
          </span>
        )}

        <button
          type="button"
          onClick={entrar}
          disabled={loading}
          className="text-sm font-semibold px-4 py-2 rounded-md mt-1"
          style={{ backgroundColor: BRAND.maroon, color: "#fff", opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "A entrar..." : "Entrar"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// VISTA DO MOTORISTA — só leitura + fase da entrega
// ---------------------------------------------------------------------
function MotoristaView({ profile, entregas, allowOfficeSwitch, onSwitchOffice, onExit, onUpdateEstado }) {
  const minhas = entregas
    .filter((e) => e.estado !== "Entregue" && e.responsavel_id === profile.id)
    .sort((a, b) => (a.data_prevista || "").localeCompare(b.data_prevista || ""));

  return (
    <div className="min-h-screen" style={{ backgroundColor: BRAND.paper }}>
      <div className="px-5 py-4 flex items-center justify-between" style={{ backgroundColor: BRAND.white, borderBottom: `3px solid ${BRAND.maroon}` }}>
        <Logo height={30} />
        <div className="flex items-center gap-2">
          {allowOfficeSwitch && (
            <button onClick={onSwitchOffice} className="text-xs font-semibold px-3 py-2 rounded-md" style={{ color: BRAND.ink, border: `1px solid ${BRAND.line}` }}>
              Vista do escritório
            </button>
          )}
          <button onClick={onExit} aria-label="Sair" className="p-2">
            <LogOut size={16} style={{ color: BRAND.inkSoft }} />
          </button>
        </div>
      </div>

      <div className="max-w-md mx-auto px-5 py-6">
        <h2 className="text-lg font-bold mb-1" style={{ color: BRAND.ink }}>
          Olá, {profile.name}
        </h2>
        <p className="text-sm mb-5" style={{ color: BRAND.inkSoft }}>
          As suas entregas, da mais próxima para a mais distante.
        </p>

        {minhas.length === 0 ? (
          <div className="text-center py-14 rounded-lg text-sm" style={{ color: BRAND.inkSoft, border: `1px dashed ${BRAND.line}` }}>
            Sem entregas atribuídas a si neste momento.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {minhas.map((item) => (
              <div key={item.id} className="rounded-lg p-4 flex flex-col gap-2" style={{ backgroundColor: BRAND.white, border: `1px solid ${BRAND.line}` }}>
                <span className="font-bold text-base" style={{ color: BRAND.ink }}>
                  {item.cliente}
                </span>
                {item.veiculo && (
                  <div className="text-sm" style={{ color: BRAND.inkSoft }}>
                    Viatura: <span style={{ color: BRAND.ink }}>{item.veiculo}</span>
                  </div>
                )}
                <div className="text-sm" style={{ color: BRAND.inkSoft }}>
                  Carga: <span style={{ color: BRAND.ink }}>{item.carga}</span>
                </div>
                {item.data_prevista && (
                  <div className="text-sm" style={{ color: BRAND.inkSoft }}>
                    Data prevista: <span style={{ color: BRAND.ink }}>{formatDateTime(item.data_prevista)}</span>
                  </div>
                )}
                {item.obs && (
                  <div className="text-sm rounded-md px-3 py-2 mt-1" style={{ backgroundColor: BRAND.amber + "1A", color: BRAND.ink }}>
                    <span className="font-semibold">Nota do escritório: </span>
                    {item.obs}
                  </div>
                )}
                <div className="text-sm mt-1" style={{ color: BRAND.inkSoft }}>
                  Local: <span style={{ color: BRAND.ink }}>{item.morada}</span>
                </div>
                <MapsButtons item={item} />
                <div className="flex gap-1.5 mt-2 pt-2" style={{ borderTop: `1px solid ${BRAND.line}` }}>
                  {BOARDS.entregas.estados.map((estado) => {
                    const ativo = item.estado === estado;
                    const cor = BOARDS.entregas.estadoCor[estado];
                    return (
                      <button
                        key={estado}
                        onClick={() => onUpdateEstado(item.id, estado)}
                        className="flex-1 text-xs font-semibold py-2 rounded-md text-center"
                        style={{ backgroundColor: ativo ? cor : cor + "15", color: ativo ? "#fff" : cor }}
                      >
                        {estado}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            <p className="text-xs text-center mt-2" style={{ color: BRAND.inkSoft }}>
              Toque na fase certa para cada entrega. A gestão vê a atualização de imediato.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// FORMULÁRIO DE NOVO REGISTO / EDIÇÃO
// ---------------------------------------------------------------------
function FieldInputs({ config, values, setValues, motoristas, errorFields }) {
  return (
    <>
      {config.fields.map((f) => (
        <div key={f.name} className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: BRAND.inkSoft }}>
            {f.label}
            {f.required ? " *" : ""}
          </label>
          {f.type === "textarea" ? (
            <textarea
              className="border rounded-md px-3 py-2 text-sm"
              style={{ borderColor: errorFields?.includes(f.name) ? BRAND.maroonDark : BRAND.line }}
              rows={2}
              value={values[f.name] || ""}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            />
          ) : f.type === "select" ? (
            <select
              className="border rounded-md px-3 py-2 text-sm bg-white"
              style={{ borderColor: errorFields?.includes(f.name) ? BRAND.maroonDark : BRAND.line }}
              value={values[f.name] || ""}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            >
              <option value="">Selecionar...</option>
              {f.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : f.type === "motorista-select" ? (
            <select
              className="border rounded-md px-3 py-2 text-sm bg-white"
              style={{ borderColor: BRAND.line }}
              value={values[f.name] || ""}
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            >
              <option value="">Selecionar...</option>
              {motoristas.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={f.type}
              className="border rounded-md px-3 py-2 text-sm"
              style={{ borderColor: errorFields?.includes(f.name) ? BRAND.maroonDark : BRAND.line }}
              value={
                (f.type === "datetime-local" || f.type === "date") && values[f.name]
                  ? String(values[f.name]).slice(0, f.type === "date" ? 10 : 16)
                  : values[f.name] || ""
              }
              onChange={(e) => setValues({ ...values, [f.name]: e.target.value })}
            />
          )}
        </div>
      ))}
    </>
  );
}

function NewItemForm({ config, motoristas, onAdd, onCancel }) {
  const initial = {};
  config.fields.forEach((f) => (initial[f.name] = ""));
  const [values, setValues] = useState(initial);
  const [tentou, setTentou] = useState(false);

  const missing = config.fields.some((f) => f.required && !values[f.name]);

  const handleSubmit = () => {
    setTentou(true);
    if (missing) return;
    onAdd(values);
  };

  return (
    <div className="rounded-lg p-4 mb-4 flex flex-col gap-3" style={{ backgroundColor: BRAND.white, border: `1px solid ${BRAND.line}` }}>
      <FieldInputs
        config={config}
        values={values}
        setValues={setValues}
        motoristas={motoristas}
        errorFields={tentou ? config.fields.filter((f) => f.required && !values[f.name]).map((f) => f.name) : []}
      />
      {tentou && missing && (
        <span className="text-xs" style={{ color: BRAND.maroonDark }}>
          Preencha os campos marcados com *.
        </span>
      )}
      <div className="flex gap-2 pt-1">
        <button type="button" onClick={handleSubmit} className="text-sm font-semibold px-4 py-2 rounded-md" style={{ backgroundColor: BRAND.maroon, color: "#fff" }}>
          Guardar
        </button>
        <button type="button" onClick={onCancel} className="text-sm font-semibold px-4 py-2 rounded-md" style={{ color: BRAND.inkSoft }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// CARTÃO DE ITEM (vista de escritório)
// ---------------------------------------------------------------------
function ItemCard({ item, config, motoristas, onChangeEstado, onDelete, onUpdateItem }) {
  const [editing, setEditing] = useState(false);
  const [editValues, setEditValues] = useState(item);

  const displayFields = config.fields.filter((f) => !f.hidden);
  const motoristaName = (id) => motoristas.find((m) => m.id === id)?.name || "—";

  const startEdit = () => {
    setEditValues(item);
    setEditing(true);
  };

  const saveEdit = () => {
    onUpdateItem(item.id, editValues);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="rounded-lg p-4 flex flex-col gap-3" style={{ backgroundColor: BRAND.white, border: `2px solid ${BRAND.maroon}` }}>
        <FieldInputs config={config} values={editValues} setValues={setEditValues} motoristas={motoristas} errorFields={[]} />
        <div className="flex gap-2 pt-1">
          <button onClick={saveEdit} className="flex items-center gap-1 text-sm font-semibold px-4 py-2 rounded-md" style={{ backgroundColor: BRAND.maroon, color: "#fff" }}>
            <Check size={14} /> Guardar alterações
          </button>
          <button onClick={() => setEditing(false)} className="text-sm font-semibold px-4 py-2 rounded-md" style={{ color: BRAND.inkSoft }}>
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-4 flex flex-col gap-3" style={{ backgroundColor: BRAND.white, border: `1px solid ${BRAND.line}` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          {displayFields.map((f) => (
            <div key={f.name} className="text-sm">
              <span style={{ color: BRAND.inkSoft }}>{f.label}: </span>
              <span className="font-semibold" style={{ color: BRAND.ink }}>
                {f.type === "datetime-local" || f.type === "date"
                  ? formatDateTime(item[f.name])
                  : f.type === "motorista-select"
                  ? motoristaName(item[f.name])
                  : item[f.name]}
              </span>
              {f.name === "morada" && item[f.name] && <MapsButtons item={item} compact />}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {config.editableCard && (
            <button onClick={startEdit} aria-label="Editar" className="p-1.5 rounded-md" style={{ color: BRAND.inkSoft }}>
              <Pencil size={16} />
            </button>
          )}
          <button onClick={() => onDelete(item.id)} aria-label="Eliminar" className="p-1.5 rounded-md" style={{ color: BRAND.inkSoft }}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <StatusPill estado={item.estado} cor={config.estadoCor[item.estado]} />
        <select value={item.estado} onChange={(e) => onChangeEstado(item.id, e.target.value)} className="text-xs border rounded-md px-2 py-1" style={{ borderColor: BRAND.line }}>
          {config.estados.map((e) => (
            <option key={e} value={e}>
              Mudar para: {e}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// VISTA DE ESCRITÓRIO
// ---------------------------------------------------------------------
function OfficeBoard({ data, motoristas, profile, error, onAdd, onChangeEstado, onDelete, onUpdateItem, onPreviewMotorista, onExit }) {
  const [activeTab, setActiveTab] = useState("orcamentos");
  const [showForm, setShowForm] = useState(false);

  const config = BOARDS[activeTab];
  const items = data[activeTab] || [];

  const visibleItems = activeTab === "entregas" ? [...items].sort((a, b) => (a.data_prevista || "").localeCompare(b.data_prevista || "")) : items;

  const clearDone = () => {
    items.filter((i) => DONE_STATES.includes(i.estado)).forEach((i) => onDelete(i.id, activeTab));
  };

  return (
    <div className="w-full min-h-screen" style={{ backgroundColor: BRAND.paper }}>
      <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3" style={{ backgroundColor: BRAND.white, borderBottom: `3px solid ${BRAND.maroon}` }}>
        <div className="flex items-center gap-4">
          <Logo height={38} />
          <div>
            <h1 className="text-base font-bold leading-tight" style={{ color: BRAND.ink }}>
              Central de Operações
            </h1>
            <p className="text-xs" style={{ color: BRAND.inkSoft }}>
              Sessão de {profile.name}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) onPreviewMotorista(e.target.value);
              e.target.value = "";
            }}
            className="text-xs font-semibold px-3 py-2 rounded-md"
            style={{ backgroundColor: BRAND.maroon, color: "#fff" }}
          >
            <option value="" disabled>
              Ver como motorista...
            </option>
            {motoristas.map((m) => (
              <option key={m.id} value={m.id} style={{ color: BRAND.ink }}>
                {m.name}
              </option>
            ))}
          </select>
          <button onClick={onExit} aria-label="Sair" className="p-2">
            <LogOut size={16} style={{ color: BRAND.inkSoft }} />
          </button>
        </div>
      </div>

      <div className="px-5 pt-4">
        <div className="max-w-3xl mx-auto flex gap-2 overflow-x-auto pb-1">
          {Object.entries(BOARDS).map(([key, cfg]) => {
            const Icon = cfg.icon;
            const count = (data[key] || []).length;
            const isActive = key === activeTab;
            return (
              <button
                key={key}
                onClick={() => {
                  setActiveTab(key);
                  setShowForm(false);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? BRAND.ink : BRAND.white,
                  color: isActive ? "#fff" : BRAND.inkSoft,
                  border: `1px solid ${isActive ? BRAND.ink : BRAND.line}`,
                }}
              >
                <Icon size={15} />
                {cfg.label}
                {count > 0 && (
                  <span
                    className="text-xs rounded-full w-5 h-5 flex items-center justify-center"
                    style={{ backgroundColor: isActive ? BRAND.maroon : BRAND.paper, color: isActive ? "#fff" : BRAND.ink }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-5 py-6">
        {error && (
          <div className="flex items-center gap-2 text-sm rounded-md px-3 py-2 mb-4" style={{ backgroundColor: "#FBEAEA", color: BRAND.maroonDark }}>
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: BRAND.ink }}>
            {config.label}
          </h2>
          <div className="flex gap-2">
            {items.some((i) => DONE_STATES.includes(i.estado)) && (
              <button onClick={clearDone} className="text-xs font-semibold px-3 py-2 rounded-md" style={{ color: BRAND.inkSoft, border: `1px solid ${BRAND.line}` }}>
                Limpar concluídos
              </button>
            )}
            <button
              onClick={() => setShowForm((s) => !s)}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-md"
              style={{ backgroundColor: showForm ? BRAND.line : BRAND.ink, color: showForm ? BRAND.ink : "#fff" }}
            >
              {showForm ? <X size={15} /> : <Plus size={15} />}
              {showForm ? "Fechar" : "Novo"}
            </button>
          </div>
        </div>

        {showForm && (
          <NewItemForm
            config={config}
            motoristas={motoristas}
            onAdd={(values) => {
              onAdd(activeTab, values);
              setShowForm(false);
            }}
            onCancel={() => setShowForm(false)}
          />
        )}

        {items.length === 0 && !showForm ? (
          <div className="text-center py-14 rounded-lg text-sm" style={{ color: BRAND.inkSoft, border: `1px dashed ${BRAND.line}` }}>
            Ainda não há nada aqui. Toque em "Novo" para adicionar o primeiro registo.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleItems.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                config={config}
                motoristas={motoristas}
                onChangeEstado={(id, estado) => onChangeEstado(activeTab, id, estado)}
                onDelete={(id) => onDelete(id, activeTab)}
                onUpdateItem={(id, values) => onUpdateItem(activeTab, id, values)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// APP — sessão, dados e ligação à Supabase
// ---------------------------------------------------------------------
export default function App() {
  const [profile, setProfile] = useState(null);
  const [motoristas, setMotoristas] = useState([]);
  const [previewId, setPreviewId] = useState(null);
  const [data, setData] = useState({ orcamentos: [], fornecedores: [], faturas: [], entregas: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadProfile = useCallback(async (userId) => {
    const { data: p } = await supabase.from("profiles").select("*").eq("id", userId).single();
    return p || null;
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [orc, forn, fat, ent, gente] = await Promise.all([
        supabase.from("orcamentos").select("*").order("created_at", { ascending: false }),
        supabase.from("fornecedores").select("*").order("created_at", { ascending: false }),
        supabase.from("faturas").select("*").order("created_at", { ascending: false }),
        supabase.from("entregas").select("*").order("data_prevista", { ascending: true }),
        supabase.from("profiles").select("*").eq("role", "motorista").order("name"),
      ]);
      setData({
        orcamentos: orc.data || [],
        fornecedores: forn.data || [],
        faturas: fat.data || [],
        entregas: ent.data || [],
      });
      setMotoristas(gente.data || []);
      setError(null);
    } catch (e) {
      setError("Não foi possível carregar os dados agora. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData?.session?.user) {
        const p = await loadProfile(sessionData.session.user.id);
        setProfile(p);
        if (p) await loadAll();
      }
      setLoading(false);
    })();
  }, [loadProfile, loadAll]);

  const handleLogin = async (p) => {
    setProfile(p);
    setLoading(true);
    await loadAll();
    setLoading(false);
  };

  const handleExit = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setPreviewId(null);
  };

  const addItem = async (tab, values) => {
    const table = BOARDS[tab].table;
    const payload = { ...sanitize(values), estado: BOARDS[tab].estados[0] };
    const { error: err } = await supabase.from(table).insert(payload);
    if (err) {
      setError("Não foi possível guardar. Tente novamente.");
      return;
    }
    await loadAll();
  };

  const changeEstado = async (tab, id, estado) => {
    const table = BOARDS[tab].table;
    const { error: err } = await supabase.from(table).update({ estado }).eq("id", id);
    if (err) {
      setError("Não foi possível guardar. Tente novamente.");
      return;
    }
    await loadAll();
  };

  const deleteItem = async (id, tab) => {
    const table = BOARDS[tab].table;
    const { error: err } = await supabase.from(table).delete().eq("id", id);
    if (err) {
      setError("Não foi possível apagar. Tente novamente.");
      return;
    }
    await loadAll();
  };

  const updateItem = async (tab, id, values) => {
    const table = BOARDS[tab].table;
    const { estado, id: _drop, created_at, ...rest } = values;
    const { error: err } = await supabase.from(table).update(sanitize(rest)).eq("id", id);
    if (err) {
      setError("Não foi possível guardar as alterações. Tente novamente.");
      return;
    }
    await loadAll();
  };

  const marcarEstado = async (id, estado) => {
    const { error: err } = await supabase.from("entregas").update({ estado }).eq("id", id);
    if (err) {
      setError("Não foi possível guardar. Tente novamente.");
      return;
    }
    await loadAll();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gap-2" style={{ backgroundColor: BRAND.paper, color: BRAND.inkSoft }}>
        <Loader2 className="animate-spin" size={18} />
        <span className="text-sm">A carregar...</span>
      </div>
    );
  }

  if (!profile) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (profile.role === "motorista") {
    return <MotoristaView profile={profile} entregas={data.entregas} allowOfficeSwitch={false} onExit={handleExit} onUpdateEstado={marcarEstado} />;
  }

  if (previewId) {
    const previewProfile = motoristas.find((m) => m.id === previewId);
    return (
      <MotoristaView
        profile={previewProfile}
        entregas={data.entregas}
        allowOfficeSwitch={true}
        onSwitchOffice={() => setPreviewId(null)}
        onExit={() => {
          setPreviewId(null);
          handleExit();
        }}
        onUpdateEstado={marcarEstado}
      />
    );
  }

  return (
    <OfficeBoard
      data={data}
      motoristas={motoristas}
      profile={profile}
      error={error}
      onAdd={addItem}
      onChangeEstado={changeEstado}
      onDelete={deleteItem}
      onUpdateItem={updateItem}
      onPreviewMotorista={(id) => setPreviewId(id)}
      onExit={handleExit}
    />
  );
}
