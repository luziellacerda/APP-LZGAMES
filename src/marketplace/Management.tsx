import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  MarketplaceProduct,
  MarketplaceNotice,
  blockMarketplaceUser,
  editMarketplaceProduct,
  loadMarketplaceBlocks,
  loadMarketplaceNotices,
  readMarketplaceNotices,
  reportMarketplaceProduct,
} from "../api";
import { parseMarketplacePrice } from "./catalog";

export const MARKETPLACE_TERMS_VERSION = "2026-09-06";
export const MARKETPLACE_RULES =
  "Publique apenas produtos seus ou cuja venda você está autorizado a realizar. Informe preço, conservação, defeitos e acessórios com clareza. Não publique produtos roubados, falsificados, ilegais, armas, drogas, conteúdo sexual, violência, discurso de ódio, dados pessoais de terceiros nem imagens sem autorização. Não são permitidos golpes, assédio, spam ou contas usadas para contornar bloqueios. Denúncias podem resultar na retirada de anúncios e suspensão da conta de vendas. A reserva não é pagamento: comprador e vendedor combinam pagamento e entrega diretamente. O app não oferece pagamento protegido, retenção de valores nem garantia de entrega. Confira o produto e a identidade da outra parte; nunca compartilhe senhas ou códigos de verificação. Use Denunciar e Bloquear vendedor quando necessário. O histórico de negociação é preservado para acompanhamento.";
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir. Tente novamente.";
function Button({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={[s.button, disabled && { opacity: 0.45 }]}
    >
      <Text style={s.buttonText}>{title}</Text>
    </Pressable>
  );
}
export function ManagementSheet({
  title,
  onClose,
  children,
  locked = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <Modal
      transparent
      animationType="slide"
      onRequestClose={() => {
        if (!locked) onClose();
      }}
    >
      <KeyboardAvoidingView
        style={s.scrim}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View accessibilityViewIsModal style={s.sheet}>
          <View style={s.header}>
            <Text accessibilityRole="header" style={s.title}>
              {title}
            </Text>
            <Button title="Fechar" disabled={locked} onPress={onClose} />
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
export function ReportSheet({
  product,
  onClose,
  onBlocked,
}: {
  product: MarketplaceProduct;
  onClose: () => void;
  onBlocked: () => void;
}) {
  const [reason, setReason] = useState("informacao_incorreta"),
    [details, setDetails] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  async function send(block = false) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      if (block) {
        await blockMarketplaceUser(product.seller.id);
        onBlocked();
      } else {
        await reportMarketplaceProduct(product.id, reason, details);
        Alert.alert(
          "Denúncia recebida",
          "O anúncio e o vendedor foram encaminhados à moderação.",
        );
        onClose();
      }
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <ManagementSheet
      title="Segurança da negociação"
      onClose={onClose}
      locked={busy}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.content}
      >
        <Text style={s.body}>
          {product.title} · {product.seller.name}
        </Text>
        <Text style={s.title}>Denunciar anúncio ou vendedor</Text>
        {[
          ["fraude", "Suspeita de golpe"],
          ["proibido", "Conteúdo ou produto proibido"],
          ["duplicado", "Spam ou anúncio duplicado"],
          ["informacao_incorreta", "Informação incorreta"],
          ["outro", "Assédio ou outro motivo"],
        ].map(([id, label]) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: reason === id }}
            disabled={busy}
            key={id}
            style={s.button}
            onPress={() => setReason(id!)}
          >
            <Text style={s.body}>
              {reason === id ? "●" : "○"} {label}
            </Text>
          </Pressable>
        ))}
        <TextInput
          accessibilityLabel="Detalhes da denúncia"
          placeholder="Explique o problema (opcional)"
          placeholderTextColor="#a9b8ca"
          style={[s.input, { minHeight: 88 }]}
          value={details}
          onChangeText={setDetails}
          maxLength={500}
          multiline
          editable={!busy}
        />
        {message ? (
          <Text accessibilityRole="alert" style={s.error}>
            {message}
          </Text>
        ) : null}
        <Button
          title={busy ? "Enviando…" : "Enviar denúncia"}
          disabled={busy}
          onPress={() => void send()}
        />
        <Text style={s.body}>
          Bloquear oculta os anúncios desse vendedor e impede novas negociações.
          O histórico permanece; reservas existentes podem ser canceladas em
          Negociações.
        </Text>
        <Button
          title="Bloquear vendedor"
          disabled={busy}
          onPress={() =>
            Alert.alert(
              "Bloquear vendedor?",
              "Você não verá seus anúncios e não poderá iniciar novas negociações.",
              [
                { text: "Voltar", style: "cancel" },
                {
                  text: "Bloquear",
                  style: "destructive",
                  onPress: () => void send(true),
                },
              ],
            )
          }
        />
      </ScrollView>
    </ManagementSheet>
  );
}
export function EditProductSheet({
  product,
  onClose,
  onSaved,
}: {
  product: MarketplaceProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(product),
    [price, setPrice] = useState(
      (product.priceCents / 100).toFixed(2).replace(".", ","),
    ),
    [cover, setCover] = useState(
      product.media.find((m) => m.kind === "image")?.id ?? 0,
    ),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const lock = useRef(false);
  const dirty =
    JSON.stringify(form) !== JSON.stringify(product) ||
    price !== (product.priceCents / 100).toFixed(2).replace(".", ",") ||
    cover !== (product.media.find((m) => m.kind === "image")?.id ?? 0);
  const close = () => {
    if (!dirty) onClose();
    else
      Alert.alert(
        "Descartar alterações?",
        "O anúncio atual não será modificado.",
        [
          { text: "Continuar editando", style: "cancel" },
          { text: "Descartar", style: "destructive", onPress: onClose },
        ],
      );
  };
  async function save() {
    if (lock.current) return;
    const cents = parseMarketplacePrice(price);
    if (!cents) {
      setMessage("Informe um preço válido, por exemplo 1.899,90.");
      return;
    }
    lock.current = true;
    setBusy(true);
    setMessage("");
    try {
      await editMarketplaceProduct({ ...form, priceCents: cents }, cover);
      onSaved();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return (
    <ManagementSheet title="Editar anúncio" onClose={close} locked={busy}>
      <ScrollView
        contentContainerStyle={s.content}
        keyboardShouldPersistTaps="handled"
      >
        {(
          [
            ["title", "Título", 80],
            ["description", "Descrição e defeitos", 2000],
            ["city", "Cidade", 80],
            ["state", "UF", 2],
          ] as const
        ).map(([key, label, max]) => (
          <View key={key}>
            <Text style={s.body}>{label}</Text>
            <TextInput
              accessibilityLabel={label}
              style={[s.input, key === "description" && { minHeight: 100 }]}
              value={form[key]}
              maxLength={max}
              multiline={key === "description"}
              editable={!busy}
              onChangeText={(value) =>
                setForm({
                  ...form,
                  [key]: key === "state" ? value.toUpperCase() : value,
                })
              }
            />
          </View>
        ))}
        <Text style={s.body}>Preço em R$</Text>
        <TextInput
          accessibilityLabel="Preço em reais"
          keyboardType="decimal-pad"
          style={s.input}
          value={price}
          maxLength={18}
          editable={!busy}
          onChangeText={setPrice}
        />
        <Text style={s.body}>Conservação</Text>
        {(
          [
            ["used_like_new", "Como novo"],
            ["used_good", "Bom estado"],
            ["used_fair", "Marcas de uso"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            title={(form.condition === id ? "● " : "○ ") + label}
            disabled={busy}
            onPress={() => setForm({ ...form, condition: id })}
          />
        ))}
        <Text style={s.body}>Categoria</Text>
        <View style={s.wrap}>
          {Object.entries({
            consoles: "Consoles",
            jogos: "Jogos",
            controles: "Controles",
            acessorios: "Acessórios",
            computadores: "Computadores",
            componentes: "Componentes",
            colecionaveis: "Colecionáveis",
            outros: "Outros",
          }).map(([id, label]) => (
            <Button
              key={id}
              title={(form.category === id ? "● " : "") + label}
              disabled={busy}
              onPress={() => setForm({ ...form, category: id })}
            />
          ))}
        </View>
        <Text style={s.body}>
          Escolha a foto de capa. As fotos e o vídeo existentes serão
          preservados.
        </Text>
        <View style={s.wrap}>
          {product.media
            .filter((m) => m.kind === "image")
            .map((m, i) => (
              <Pressable
                key={m.id}
                accessibilityRole="radio"
                accessibilityLabel={"Foto de capa " + (i + 1)}
                accessibilityState={{ checked: m.id === cover }}
                disabled={busy}
                onPress={() => setCover(m.id)}
                style={[s.photo, m.id === cover && { borderColor: "#92e8e1" }]}
              >
                <Image
                  source={{ uri: m.url }}
                  style={{ width: 68, height: 68 }}
                />
              </Pressable>
            ))}
        </View>
        {message ? (
          <Text accessibilityRole="alert" style={s.error}>
            {message}
          </Text>
        ) : null}
        <Button
          title={busy ? "Salvando…" : "Salvar alterações"}
          disabled={busy}
          onPress={() => void save()}
        />
        <Text style={s.body}>
          Anúncios reservados ou vendidos não podem ser editados. Se outra
          alteração ocorrer, você precisará reabrir o anúncio.
        </Text>
      </ScrollView>
    </ManagementSheet>
  );
}
export function AccountSheet({
  onClose,
  onChanged,
}: {
  onClose: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<"notices" | "blocks" | "rules">("notices"),
    [notices, setNotices] = useState<MarketplaceNotice[]>([]),
    [blocks, setBlocks] = useState<{ id: string; name: string }[]>([]),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const alive = useRef(true),
    lock = useRef(false),
    generation = useRef(0);
  async function refresh() {
    const epoch = ++generation.current;
    setLoading(true);
    setError("");
    try {
      const [n, b] = await Promise.all([
        loadMarketplaceNotices(),
        loadMarketplaceBlocks(),
      ]);
      if (alive.current && epoch === generation.current) {
        setNotices(n);
        setBlocks(b);
      }
    } catch (e) {
      if (alive.current && epoch === generation.current) setError(errorText(e));
    } finally {
      if (alive.current && epoch === generation.current) setLoading(false);
    }
  }
  useEffect(() => {
    void refresh();
    return () => {
      alive.current = false;
      generation.current++;
    };
  }, []);
  async function action(work: () => Promise<unknown>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    try {
      await work();
      onChanged();
      await refresh();
    } catch (e) {
      if (alive.current) setError(errorText(e));
    } finally {
      lock.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <ManagementSheet
      title="Minha conta de vendas"
      onClose={onClose}
      locked={busy}
    >
      <View style={s.wrap}>
        {(
          [
            ["notices", "Avisos"],
            ["blocks", "Bloqueados"],
            ["rules", "Regras"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            title={(tab === id ? "● " : "") + label}
            disabled={busy}
            onPress={() => setTab(id)}
          />
        ))}
      </View>
      <ScrollView contentContainerStyle={s.content}>
        {loading ? <ActivityIndicator color="#92e8e1" /> : null}
        {error ? (
          <>
            <Text style={s.error}>{error}</Text>
            <Button title="Tentar novamente" onPress={() => void refresh()} />
          </>
        ) : null}
        {tab === "rules" ? (
          <Text style={s.body}>{MARKETPLACE_RULES}</Text>
        ) : tab === "blocks" ? (
          <>
            {!loading && !error && !blocks.length ? (
              <Text style={s.body}>Nenhum vendedor bloqueado.</Text>
            ) : null}
            {blocks.map((b) => (
              <View key={b.id} style={s.card}>
                <Text style={s.body}>{b.name}</Text>
                <Button
                  title="Desbloquear"
                  disabled={busy}
                  onPress={() =>
                    Alert.alert(
                      "Desbloquear vendedor?",
                      "Seus anúncios poderão voltar a aparecer.",
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Desbloquear",
                          onPress: () =>
                            void action(() =>
                              blockMarketplaceUser(b.id, false),
                            ),
                        },
                      ],
                    )
                  }
                />
              </View>
            ))}
          </>
        ) : (
          <>
            <Text style={s.body}>
              Atualizações das suas negociações. Estes avisos ficam dentro da
              loja; não são notificações push.
            </Text>
            {notices.some((n) => !n.readAt) ? (
              <Button
                title="Marcar avisos como lidos"
                disabled={busy}
                onPress={() =>
                  void action(() =>
                    readMarketplaceNotices(
                      Math.max(...notices.map((n) => Number(n.id))),
                    ),
                  )
                }
              />
            ) : null}
            {!loading && !error && !notices.length ? (
              <Text style={s.body}>Sem avisos por enquanto.</Text>
            ) : null}
            {notices.map((n) => (
              <View key={n.id} style={s.card}>
                <Text style={s.title}>
                  {n.readAt ? "" : "● "}
                  {n.title}
                </Text>
                <Text style={s.body}>{n.message}</Text>
                {n.orderCode ? <Text style={s.body}>{n.orderCode}</Text> : null}
                <Text style={s.small}>
                  {new Date(n.createdAt).toLocaleString("pt-BR")}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </ManagementSheet>
  );
}
const s = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "#000a",
    justifyContent: "flex-end",
    paddingTop: 48,
  },
  sheet: {
    maxHeight: "94%",
    backgroundColor: "#101925",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 38,
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingVertical: 12,
  },
  title: { color: "#f4f7fc", fontSize: 17, fontWeight: "700", flexShrink: 1 },
  content: { paddingBottom: 24, gap: 14 },
  body: { color: "#c4d0df", fontSize: 14, lineHeight: 22 },
  small: { color: "#a9b8ca", fontSize: 12 },
  button: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#35475b",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    justifyContent: "center",
  },
  buttonText: {
    color: "#92e8e1",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: "#35475b",
    borderRadius: 12,
    color: "#f4f7fc",
    minHeight: 48,
    padding: 12,
    fontSize: 15,
  },
  error: { color: "#ffada8", fontSize: 14, lineHeight: 21 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingBottom: 8 },
  photo: {
    borderWidth: 3,
    borderColor: "transparent",
    borderRadius: 10,
    padding: 2,
  },
  card: {
    borderBottomWidth: 1,
    borderBottomColor: "#2a394c",
    paddingVertical: 14,
    gap: 8,
  },
});
