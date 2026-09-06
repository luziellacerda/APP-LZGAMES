import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar as NativeStatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import {
  MarketplaceOrder,
  MarketplaceProduct,
  changeMarketplaceOrder,
  changeMarketplaceProductStatus,
  createMarketplaceProduct,
  marketplaceRequestKey,
  loadMarketplaceNotices,
  loadMarketplace,
  loadMarketplaceOrders,
  loadMarketplaceProduct,
  loadMyMarketplaceProducts,
  requestMarketplacePurchase,
} from "./api";
import {
  createCatalogController,
  parseMarketplacePrice,
} from "./marketplace/catalog";
import {
  AccountSheet,
  EditProductSheet,
  ReportSheet,
  MARKETPLACE_RULES,
  MARKETPLACE_TERMS_VERSION,
} from "./marketplace/Management";

type Section = "catalog" | "sell" | "mine" | "orders";
const C = {
  bg: "#0b1018",
  surface: "#141c28",
  raised: "#1c2838",
  line: "#2a394c",
  text: "#f4f7fc",
  muted: "#a9b8ca",
  dim: "#8295ab",
  accent: "#92e8e1",
  gold: "#f4d795",
  danger: "#ffada8",
};
const CATEGORIES = [
  ["", "Todos"],
  ["consoles", "Consoles"],
  ["jogos", "Jogos"],
  ["controles", "Controles"],
  ["acessorios", "Acessórios"],
  ["computadores", "Computadores"],
  ["componentes", "Componentes"],
  ["colecionaveis", "Colecionáveis"],
  ["outros", "Outros"],
] as const;
const CONDITIONS = [
  ["used_like_new", "Como novo"],
  ["used_good", "Bom estado"],
  ["used_fair", "Marcas de uso"],
] as const;
const STATUS: Record<string, string> = {
  active: "À venda",
  paused: "Pausado",
  reserved: "Reservado",
  sold: "Vendido",
  closed: "Encerrado",
  requested: "Aguardando vendedor",
  accepted: "Reserva aceita",
  rejected: "Recusada",
  cancelled: "Cancelada",
  completed: "Concluída",
};
const price = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
const label = (list: readonly (readonly [string, string])[], value: string) =>
  list.find((item) => item[0] === value)?.[1] ?? value;
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir. Tente novamente.";

function Action({
  title,
  onPress,
  busy = false,
  disabled = false,
  secondary = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  secondary?: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.buttonSecondary,
        (disabled || busy) && s.disabled,
        pressed && s.pressed,
      ]}
    >
      {busy ? <ActivityIndicator color={secondary ? C.accent : C.bg} /> : null}
      <Text style={[s.buttonText, secondary && s.buttonSecondaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}
function IconButton({
  label: accessibleLabel,
  glyph,
  onPress,
  disabled = false,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibleLabel}
      disabled={disabled}
      style={({ pressed }) => [
        s.iconButton,
        disabled && s.disabled,
        pressed && s.pressed,
      ]}
      onPress={onPress}
    >
      <Text style={s.iconGlyph}>{glyph}</Text>
    </Pressable>
  );
}
function Notice({
  text,
  error = false,
  onRetry,
}: {
  text: string;
  error?: boolean;
  onRetry?: () => void;
}) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[s.notice, error && s.noticeError]}
    >
      <Text style={[s.noticeText, error && s.errorText]}>{text}</Text>
      {onRetry ? (
        <Action title="Tentar novamente" secondary onPress={onRetry} />
      ) : null}
    </View>
  );
}
function Empty({
  title,
  text,
  action,
  onPress,
}: {
  title: string;
  text: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View style={s.empty}>
      <View style={s.emptyArt}>
        <View style={s.emptyBox} />
        <View style={s.emptySpark} />
      </View>
      <Text style={s.emptyTitle}>{title}</Text>
      <Text style={s.emptyText}>{text}</Text>
      {action && onPress ? (
        <Action title={action} secondary onPress={onPress} />
      ) : null}
    </View>
  );
}
function StatusPill({ value }: { value: string }) {
  return (
    <View
      style={[
        s.pill,
        ["active", "completed"].includes(value)
          ? s.pillGood
          : ["reserved", "requested", "accepted"].includes(value)
            ? s.pillWarm
            : s.pillNeutral,
      ]}
    >
      <Text style={s.pillText}>{STATUS[value] ?? "Indisponível"}</Text>
    </View>
  );
}
function ProductImage({
  uri,
  style,
  contain = false,
}: {
  uri?: string;
  style?: any;
  contain?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  if (!uri || failed)
    return (
      <View style={[s.imageFallback, style]}>
        <Text style={s.imageFallbackBrand}>LZ / GAMES</Text>
        <Text style={s.caption}>Foto indisponível</Text>
      </View>
    );
  return (
    <Image
      accessible={false}
      source={{ uri }}
      style={style}
      resizeMode={contain ? "contain" : "cover"}
      onError={() => setFailed(true)}
    />
  );
}
function ProductCard({
  product,
  onPress,
  compact = false,
}: {
  product: MarketplaceProduct;
  onPress: () => void;
  compact?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        product.title + ", " + price(product.priceCents) + ", " + product.city
      }
      onPress={onPress}
      style={({ pressed }) => [
        s.product,
        compact && s.productCompact,
        pressed && s.pressed,
      ]}
    >
      <View style={compact ? s.compactMedia : s.productMedia}>
        <ProductImage
          uri={product.media.find((item) => item.kind === "image")?.url}
          style={s.fill}
        />
        {!compact && product.media.some((item) => item.kind === "video") ? (
          <View style={s.videoBadge}>
            <Text style={s.videoBadgeText}>▶ Vídeo</Text>
          </View>
        ) : null}
      </View>
      <View style={s.productCopy}>
        <Text style={s.productCategory}>
          {product.isMine ? "Seu anúncio" : label(CATEGORIES, product.category)}
        </Text>
        <Text numberOfLines={2} style={s.productTitle}>
          {product.title}
        </Text>
        <Text style={s.productPrice}>{price(product.priceCents)}</Text>
        <Text numberOfLines={1} style={s.caption}>
          {label(CONDITIONS, product.condition)}
        </Text>
        <Text numberOfLines={1} style={s.caption}>
          {product.city + " · " + product.state}
        </Text>
      </View>
    </Pressable>
  );
}
function FilterSheet({
  visible,
  onClose,
  category,
  condition,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  category: string;
  condition: string;
  onApply: (category: string, condition: string) => void;
}) {
  const [cat, setCat] = useState(category),
    [cond, setCond] = useState(condition);
  useEffect(() => {
    if (visible) {
      setCat(category);
      setCond(condition);
    }
  }, [visible, category, condition]);
  return (
    <Modal
      transparent
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={s.modalShade}>
        <Pressable
          accessibilityLabel="Fechar filtros"
          onPress={onClose}
          style={s.modalBackdrop}
        />
        <View accessibilityViewIsModal style={s.sheet}>
          <View style={s.sheetHandle} />
          <View style={s.sheetHeading}>
            <Text style={[s.title, s.flex]}>Encontre seu próximo game</Text>
            <IconButton label="Fechar filtros" glyph="×" onPress={onClose} />
          </View>
          <ScrollView contentContainerStyle={s.sheetContent}>
            <Text style={s.fieldLabel}>Categoria</Text>
            <View style={s.wrap}>
              {CATEGORIES.map(([id, title]) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: cat === id }}
                  key={id}
                  style={[s.chip, cat === id && s.chipActive]}
                  onPress={() => setCat(id)}
                >
                  <Text style={[s.chipText, cat === id && s.chipTextActive]}>
                    {title}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.fieldLabel}>Conservação</Text>
            <View style={s.wrap}>
              {[["", "Qualquer estado"], ...CONDITIONS].map(([id, title]) => (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ checked: cond === id }}
                  key={id}
                  style={[s.chip, cond === id && s.chipActive]}
                  onPress={() => setCond(id)}
                >
                  <Text style={[s.chipText, cond === id && s.chipTextActive]}>
                    {title}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={s.bodyMuted}>
              Os anúncios mais recentes aparecem primeiro.
            </Text>
          </ScrollView>
          <View style={s.sheetActions}>
            <Action
              title="Limpar"
              secondary
              onPress={() => {
                setCat("");
                setCond("");
              }}
            />
            <View style={s.flex}>
              <Action
                title="Ver resultados"
                onPress={() => onApply(cat, cond)}
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
function Catalog({
  onSelect,
  onSell,
}: {
  onSelect: (product: MarketplaceProduct) => void;
  onSell: () => void;
}) {
  const { width, fontScale } = useWindowDimensions();
  const columns = width < 300 || fontScale > 1.4 ? 1 : 2;
  const [query, setQuery] = useState(""),
    [category, setCategory] = useState(""),
    [condition, setCondition] = useState(""),
    [filtersOpen, setFiltersOpen] = useState(false);
  const controllerRef = useRef<ReturnType<
    typeof createCatalogController
  > | null>(null);
  const [data, setData] = useState({
    products: [] as MarketplaceProduct[],
    nextCursor: null as string | null,
    loading: true,
    loadingMore: false,
    error: "",
  });
  const list = useRef<FlatList<MarketplaceProduct>>(null);
  useEffect(() => {
    const controller = createCatalogController(loadMarketplace);
    controllerRef.current = controller;
    const unsubscribe = controller.subscribe(setData);
    return () => {
      unsubscribe();
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);
  useEffect(() => {
    controllerRef.current?.invalidate();
    const timer = setTimeout(
      () => {
        list.current?.scrollToOffset({ offset: 0, animated: false });
        void controllerRef.current?.search({ query, category, condition });
      },
      query ? 400 : 0,
    );
    return () => clearTimeout(timer);
  }, [query, category, condition]);
  const clear = () => {
    setQuery("");
    setCategory("");
    setCondition("");
  };
  const filtered = !!(query || category || condition);
  const header = (
    <View style={s.catalogHeader}>
      {!filtered && width >= 360 && fontScale <= 1.4 ? (
        <View style={s.hero}>
          <View style={s.heroCopy}>
            <Text style={s.eyebrow}>GAMES COM NOVAS HISTÓRIAS</Text>
            <Text style={s.heroTitle}>Seu próximo{"\n"}upgrade.</Text>
            <Text style={s.heroText}>Encontre. Negocie. Jogue.</Text>
          </View>
          <View accessible={false} pointerEvents="none" style={s.controllerArt}>
            <View style={s.orbit} />
            <View style={s.controllerBody}>
              <View style={s.dpadH} />
              <View style={s.dpadV} />
              <View style={s.padDot1} />
              <View style={s.padDot2} />
              <View style={s.padStick1} />
              <View style={s.padStick2} />
            </View>
            <View style={s.artTag}>
              <Text style={s.artTagText}>PLAYER TO PLAYER</Text>
            </View>
          </View>
        </View>
      ) : null}
      <View style={s.rowBetween}>
        <Text style={s.subtitle}>
          {filtered ? "Resultados da busca" : "Explore a comunidade"}
        </Text>
        <Text style={s.caption}>Mais recentes</Text>
      </View>
      {data.products.length ? (
        <Text accessibilityLiveRegion="polite" style={s.caption}>
          {data.products.length + " anúncio(s) carregado(s)"}
        </Text>
      ) : null}
      {data.error ? (
        <Notice
          text={data.error}
          error
          onRetry={() => void controllerRef.current?.refresh()}
        />
      ) : null}
    </View>
  );
  return (
    <View style={s.flex}>
      <View style={s.searchArea}>
        <View style={s.searchBox}>
          <Text style={s.searchGlyph}>⌕</Text>
          <TextInput
            accessibilityLabel="Buscar produtos"
            maxLength={80}
            value={query}
            onChangeText={setQuery}
            placeholder="O que você quer jogar?"
            placeholderTextColor={C.dim}
            style={s.searchInput}
            returnKeyType="search"
          />
          {query ? (
            <IconButton
              label="Limpar pesquisa"
              glyph="×"
              onPress={() => setQuery("")}
            />
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Abrir filtros"
            onPress={() => setFiltersOpen(true)}
            style={s.filterButton}
          >
            <Text style={s.filterText}>
              {condition ? "Filtros •" : "Filtros"}
            </Text>
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.quickCategories}
        >
          {CATEGORIES.slice(0, 5).map(([id, title]) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: category === id }}
              key={id}
              onPress={() => setCategory(id)}
              style={[s.categoryTab, category === id && s.categoryTabOn]}
            >
              <Text
                style={[s.categoryText, category === id && s.categoryTextOn]}
              >
                {title}
              </Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => setFiltersOpen(true)}
            style={s.categoryTab}
          >
            <Text style={s.categoryText}>Mais +</Text>
          </Pressable>
        </ScrollView>
        {condition ||
        !CATEGORIES.slice(0, 5).some((item) => item[0] === category) ? (
          <Pressable
            accessibilityRole="button"
            style={s.appliedFilters}
            onPress={clear}
          >
            <Text style={s.caption}>
              {[
                category ? label(CATEGORIES, category) : "",
                condition ? label(CONDITIONS, condition) : "",
              ]
                .filter(Boolean)
                .join(" · ") + "  × Limpar"}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <FlatList
        key={columns}
        ref={list}
        testID="marketplace-catalog"
        data={data.products}
        numColumns={columns}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[s.gridItem, columns > 1 && { maxWidth: "48.5%" }]}>
            <ProductCard product={item} onPress={() => onSelect(item)} />
          </View>
        )}
        columnWrapperStyle={columns > 1 ? s.gridRow : undefined}
        contentContainerStyle={s.catalogContent}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={data.loading}
            onRefresh={() => void controllerRef.current?.refresh()}
            tintColor={C.accent}
          />
        }
        ListEmptyComponent={
          data.loading ? (
            <View
              accessibilityLabel="Carregando anúncios"
              style={s.skeletonGrid}
            >
              {[0, 1].map((id) => (
                <View key={id} style={s.skeletonCard}>
                  <View style={s.skeletonPhoto} />
                  <View style={s.skeletonLine} />
                  <View style={[s.skeletonLine, { width: "50%" }]} />
                </View>
              ))}
            </View>
          ) : !data.error ? (
            <Empty
              title={
                filtered
                  ? "Nada por aqui, ainda."
                  : "O próximo anúncio pode ser seu."
              }
              text={
                filtered
                  ? "Tente outro nome ou amplie os filtros para encontrar mais produtos."
                  : "A comunidade está começando. Publique fotos reais e apresente seu produto a outros jogadores."
              }
              action={filtered ? "Limpar filtros" : "Criar meu anúncio"}
              onPress={filtered ? clear : onSell}
            />
          ) : null
        }
        ListFooterComponent={
          <View style={s.listFooter}>
            {data.nextCursor ? (
              <Action
                title="Carregar mais anúncios"
                busy={data.loadingMore}
                secondary
                onPress={() => void controllerRef.current?.more()}
              />
            ) : data.products.length ? (
              <Text style={s.footerText}>
                Você viu todos os resultados desta busca.
              </Text>
            ) : null}
            <Text style={s.safetyCaption}>
              Negociação direta entre clientes. Confira o produto antes de
              pagar.
            </Text>
          </View>
        }
      />
      <FilterSheet
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        category={category}
        condition={condition}
        onApply={(cat, cond) => {
          setCategory(cat);
          setCondition(cond);
          setFiltersOpen(false);
        }}
      />
    </View>
  );
}
function ProductVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (current) => {
    current.loop = false;
    current.muted = true;
  });
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") player.pause();
    });
    return () => subscription.remove();
  }, [player]);
  return (
    <VideoView
      player={player}
      nativeControls
      contentFit="contain"
      style={s.detailVideo}
    />
  );
}
function ProductDetails({
  initial,
  onBack,
  onReserved,
  onBusy,
  onBlocked,
}: {
  initial: MarketplaceProduct;
  onBack: () => void;
  onReserved: () => void;
  onBusy: (busy: boolean) => void;
  onBlocked: () => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [product, setProduct] = useState(initial),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false),
    [galleryWidth, setGalleryWidth] = useState(0),
    [photo, setPhoto] = useState(0),
    [fullscreen, setFullscreen] = useState(false),
    [playVideo, setPlayVideo] = useState(false);
  const busyRef = useRef(false),
    alive = useRef(true),
    epoch = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++epoch.current;
    setLoading(true);
    setError("");
    try {
      const next = await loadMarketplaceProduct(initial.id);
      if (alive.current && id === epoch.current) setProduct(next);
    } catch (e) {
      if (alive.current && id === epoch.current) setError(errorText(e));
    } finally {
      if (alive.current && id === epoch.current) setLoading(false);
    }
  }, [initial.id]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
      epoch.current++;
    };
  }, [refresh]);
  const images = product.media.filter((item) => item.kind === "image"),
    video = product.media.find((item) => item.kind === "video");
  async function mutate(fn: () => Promise<void>) {
    if (!alive.current || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    onBusy(true);
    setFeedback("");
    try {
      await fn();
    } catch (e) {
      if (alive.current) setFeedback(errorText(e));
    } finally {
      busyRef.current = false;
      onBusy(false);
      if (alive.current) setBusy(false);
    }
  }
  function buy() {
    if (busyRef.current || loading || error) return;
    Alert.alert(
      "Confirmar reserva",
      product.title +
        "\n" +
        price(product.priceCents) +
        "\n\nO vendedor tem até 24 horas para aceitar. Não há cobrança no aplicativo; pagamento e entrega são combinados diretamente.",
      [
        { text: "Agora não", style: "cancel" },
        {
          text: "Confirmar reserva",
          onPress: () =>
            void mutate(async () => {
              const order = await requestMarketplacePurchase(product.id);
              Alert.alert(
                "Reserva registrada",
                order.publicCode +
                  "\nAcompanhe em Negociações e fale com o vendedor para combinar os próximos passos.",
              );
              onReserved();
            }),
        },
      ],
    );
  }
  return (
    <View style={s.flex}>
      {reporting ? (
        <ReportSheet
          product={product}
          onClose={() => setReporting(false)}
          onBlocked={() => {
            setReporting(false);
            onBlocked();
          }}
        />
      ) : null}
      <ScrollView
        contentContainerStyle={s.detailContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? <ActivityIndicator color={C.accent} /> : null}
        {error ? (
          <Notice text={error} error onRetry={() => void refresh()} />
        ) : null}
        <View
          onLayout={(e) => setGalleryWidth(e.nativeEvent.layout.width)}
          style={s.gallery}
        >
          {galleryWidth > 0 && images.length ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setPhoto(
                  Math.max(
                    0,
                    Math.min(
                      images.length - 1,
                      Math.round(e.nativeEvent.contentOffset.x / galleryWidth),
                    ),
                  ),
                )
              }
            >
              {images.map((image, index) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={"Ampliar foto " + (index + 1)}
                  key={image.id}
                  onPress={() => {
                    setPhoto(index);
                    setFullscreen(true);
                  }}
                >
                  <ProductImage
                    uri={image.url}
                    contain
                    style={{ width: galleryWidth, height: galleryWidth * 0.88 }}
                  />
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={s.noGallery}>
              <Text style={s.caption}>Foto indisponível</Text>
            </View>
          )}
          {images.length ? (
            <View pointerEvents="none" style={s.photoCounter}>
              <Text style={s.photoCounterText}>
                {photo + 1 + " / " + images.length + "  ·  Toque para ampliar"}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={s.detailCopy}>
          <View style={s.rowBetween}>
            <Text style={s.eyebrow}>
              {label(CATEGORIES, product.category).toUpperCase()}
            </Text>
            <StatusPill value={product.status} />
          </View>
          <Text style={s.detailTitle}>{product.title}</Text>
          <Text style={s.detailPrice}>{price(product.priceCents)}</Text>
          <View style={s.wrap}>
            <View style={s.infoChip}>
              <Text style={s.caption}>
                {label(CONDITIONS, product.condition)}
              </Text>
            </View>
            <View style={s.infoChip}>
              <Text style={s.caption}>
                {product.city + " / " + product.state}
              </Text>
            </View>
          </View>
          <View style={s.divider} />
          <Text style={s.subtitle}>Sobre o produto</Text>
          <Text style={s.description}>{product.description}</Text>
          {video ? (
            <View style={s.videoPanel}>
              {playVideo ? (
                <ProductVideo uri={video.url} />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Assistir vídeo do produto"
                  style={s.videoPreview}
                  onPress={() => setPlayVideo(true)}
                >
                  <ProductImage
                    uri={video.posterUrl ?? undefined}
                    style={s.fill}
                  />
                  <View style={s.videoPlay}>
                    <Text style={s.videoPlayText}>▶</Text>
                  </View>
                </Pressable>
              )}
              <Text style={s.caption}>
                Vídeo do vendedor · reprodução sob demanda
              </Text>
            </View>
          ) : null}
          <View style={s.seller}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>
                {product.seller.name.trim().charAt(0).toUpperCase() || "LZ"}
              </Text>
            </View>
            <View style={s.flex}>
              <Text style={s.caption}>Anunciado por</Text>
              <Text style={s.sellerName}>{product.seller.name}</Text>
              <Text style={s.caption}>
                Cliente cadastrado · contato após reserva
              </Text>
            </View>
          </View>
          <View style={s.safety}>
            <Text style={s.safetyTitle}>
              Uma boa negociação começa com cuidado.
            </Text>
            <Text style={s.bodyMuted}>
              Confira funcionamento, acessórios e estado real. Não pague taxas
              de liberação nem compartilhe códigos de acesso. A LZ-GAMES não
              retém o pagamento desta negociação.
            </Text>
          </View>
          {feedback ? <Notice text={feedback} /> : null}
          {!product.isMine ? (
            <Action
              title="Denunciar este anúncio"
              secondary
              disabled={busy}
              onPress={() => setReporting(true)}
            />
          ) : null}
        </View>
      </ScrollView>
      <View style={s.purchaseDock}>
        <View style={s.flex}>
          <Text style={s.caption}>Valor anunciado</Text>
          <Text style={s.dockPrice}>{price(product.priceCents)}</Text>
        </View>
        <View style={s.flex}>
          <Action
            title={
              product.isMine
                ? "Seu anúncio"
                : product.status === "active"
                  ? "Reservar produto"
                  : "Indisponível"
            }
            disabled={
              product.isMine ||
              product.moderationStatus === "hidden" ||
              product.status !== "active" ||
              loading ||
              !!error
            }
            busy={busy}
            onPress={buy}
          />
        </View>
      </View>
      <Modal
        visible={fullscreen}
        transparent
        animationType="fade"
        onRequestClose={() => setFullscreen(false)}
      >
        <View accessibilityViewIsModal style={s.fullscreen}>
          <View style={s.fullscreenHeader}>
            <Text style={s.body}>{photo + 1 + " de " + images.length}</Text>
            <IconButton
              label="Fechar foto"
              glyph="×"
              onPress={() => setFullscreen(false)}
            />
          </View>
          <ProductImage
            uri={images[photo]?.url}
            contain
            style={s.fullscreenImage}
          />
          <View style={s.fullscreenControls}>
            <IconButton
              label="Foto anterior"
              glyph="‹"
              disabled={photo === 0}
              onPress={() => setPhoto((p) => p - 1)}
            />
            <IconButton
              label="Próxima foto"
              glyph="›"
              disabled={photo === images.length - 1}
              onPress={() => setPhoto((p) => p + 1)}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function Field({
  title,
  children,
  hint,
}: {
  title: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{title}</Text>
      {children}
      {hint ? <Text style={s.caption}>{hint}</Text> : null}
    </View>
  );
}
function SellerForm({
  onCreated,
  onDirty,
  onBusy,
}: {
  onCreated: () => void;
  onDirty: (dirty: boolean) => void;
  onBusy: (busy: boolean) => void;
}) {
  const requestKey = useRef(marketplaceRequestKey());
  const [showRules, setShowRules] = useState(false);
  const [step, setStep] = useState(0),
    [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [category, setCategory] = useState("jogos"),
    [condition, setCondition] = useState("used_good");
  const [priceInput, setPriceInput] = useState(""),
    [city, setCity] = useState("Maceió"),
    [state, setState] = useState("AL");
  const [photos, setPhotos] = useState<ImagePicker.ImagePickerAsset[]>([]),
    [video, setVideo] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [terms, setTerms] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const busyRef = useRef(false),
    pickerRef = useRef(false),
    alive = useRef(true),
    scroll = useRef<ScrollView>(null);
  const cents = parseMarketplacePrice(priceInput),
    dirty = !!(title || description || priceInput || photos.length || video);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const go = (next: number) => {
    setMessage("");
    setStep(next);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (busyRef.current) return true;
        if (step > 0) {
          go(step - 1);
          return true;
        }
        return false;
      },
    );
    return () => subscription.remove();
  }, [step]);
  const pick = async (kind: "photos" | "video") => {
    if (
      pickerRef.current ||
      busyRef.current ||
      (kind === "photos" && photos.length >= 5)
    )
      return;
    pickerRef.current = true;
    try {
      const result = await ImagePicker.launchImageLibraryAsync(
        kind === "photos"
          ? {
              mediaTypes: ["images"],
              allowsMultipleSelection: true,
              selectionLimit: 5 - photos.length,
              orderedSelection: true,
              quality: 0.85,
            }
          : {
              mediaTypes: ["videos"],
              allowsMultipleSelection: false,
              videoMaxDuration: 30,
            },
      );
      if (!alive.current || result.canceled) return;
      if (kind === "photos")
        setPhotos((current) => {
          const seen = new Set(current.map((a) => a.assetId ?? a.uri));
          return [
            ...current,
            ...result.assets.filter((a) => !seen.has(a.assetId ?? a.uri)),
          ].slice(0, 5);
        });
      else {
        const asset = result.assets[0];
        if (!asset) return;
        if (asset.duration && asset.duration > 30750) {
          setMessage("Escolha um vídeo de até 30 segundos.");
          return;
        }
        if (asset.fileSize && asset.fileSize > 35 * 1024 * 1024) {
          setMessage(
            "O vídeo original deve ter até 35 MB. Reduza a duração ou resolução e selecione novamente.",
          );
          return;
        }
        setVideo(asset);
      }
      setMessage("");
    } catch (e) {
      if (alive.current)
        setMessage(
          "Não foi possível abrir a galeria. Confira a permissão de fotos nas configurações do celular.",
        );
    } finally {
      pickerRef.current = false;
    }
  };
  const validate = () => {
    if (step === 0) {
      if (title.trim().length < 3)
        return "Dê um título com pelo menos 3 caracteres.";
      if (description.trim().length < 10)
        return "Descreva o produto com pelo menos 10 caracteres.";
      if (!cents) return "Informe o preço em reais, por exemplo 1.899,90.";
      if (city.trim().length < 2 || !/^[A-Za-z]{2}$/.test(state.trim()))
        return "Confira a cidade e a UF.";
    }
    if (step === 1) {
      if (!photos.length)
        return "Adicione pelo menos uma foto real do produto.";
      const files = [...photos, ...(video ? [video] : [])];
      if (
        files.some((a) => (a.fileSize ?? 0) > 35 * 1024 * 1024) ||
        files.reduce((sum, a) => sum + (a.fileSize ?? 0), 0) > 45 * 1024 * 1024
      )
        return "As mídias devem somar até 45 MB, com no máximo 35 MB por arquivo.";
    }
    return "";
  };
  const next = () => {
    const error = validate();
    if (error) {
      setMessage(error);
      return;
    }
    go(step + 1);
  };
  const publish = async () => {
    if (busyRef.current) return;
    if (!terms) {
      setMessage(
        "Confirme a responsabilidade pelas informações para publicar.",
      );
      return;
    }
    busyRef.current = true;
    setBusy(true);
    onBusy(true);
    setMessage("");
    try {
      await createMarketplaceProduct({
        title: title.trim(),
        description: description.trim(),
        category,
        condition,
        priceCents: cents,
        city: city.trim(),
        state: state.trim().toUpperCase(),
        photos,
        video,
        requestKey: requestKey.current,
        termsVersion: MARKETPLACE_TERMS_VERSION,
      });
      if (alive.current) {
        onDirty(false);
        Alert.alert(
          "Seu anúncio está no ar",
          "Você pode acompanhar a publicação em Meus anúncios.",
        );
        onCreated();
      }
    } catch (e) {
      if (alive.current)
        setMessage(
          errorText(e) +
            " Antes de reenviar após uma falha de conexão, confira Meus anúncios para evitar duplicação.",
        );
    } finally {
      busyRef.current = false;
      onBusy(false);
      if (alive.current) setBusy(false);
    }
  };
  return (
    <KeyboardAvoidingView
      style={s.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={s.steps}>
        {["O produto", "Fotos e vídeo", "Revisão"].map((text, index) => (
          <View key={text} style={s.step}>
            <View style={[s.stepNumber, index <= step && s.stepNumberOn]}>
              <Text style={[s.stepDigit, index <= step && s.stepDigitOn]}>
                {index < step ? "✓" : index + 1}
              </Text>
            </View>
            <Text style={[s.stepLabel, index === step && s.stepLabelOn]}>
              {text}
            </Text>
          </View>
        ))}
      </View>
      <ScrollView
        ref={scroll}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.formContent}
      >
        <View>
          <Text style={s.title}>
            {
              [
                "O que você quer vender?",
                "Mostre todos os detalhes.",
                "Tudo pronto para publicar?",
              ][step]
            }
          </Text>
          <Text style={s.bodyMuted}>
            {
              [
                "Informações claras ajudam o comprador a decidir.",
                "A primeira foto será a capa do anúncio.",
                "Confira como seu produto será apresentado.",
              ][step]
            }
          </Text>
        </View>
        {step === 0 ? (
          <>
            <Field
              title="Título do anúncio"
              hint={title.length + "/80 caracteres"}
            >
              <TextInput
                accessibilityLabel="Título do anúncio"
                maxLength={80}
                style={s.input}
                value={title}
                onChangeText={setTitle}
                placeholder="Ex.: PlayStation 5 com dois controles"
                placeholderTextColor={C.dim}
              />
            </Field>
            <Field title="Categoria">
              <View style={s.wrap}>
                {CATEGORIES.slice(1).map(([id, text]) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: category === id }}
                    key={id}
                    style={[s.chip, category === id && s.chipActive]}
                    onPress={() => setCategory(id)}
                  >
                    <Text
                      style={[s.chipText, category === id && s.chipTextActive]}
                    >
                      {text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field title="Conservação">
              <View style={s.wrap}>
                {CONDITIONS.map(([id, text]) => (
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: condition === id }}
                    key={id}
                    style={[s.chip, condition === id && s.chipActive]}
                    onPress={() => setCondition(id)}
                  >
                    <Text
                      style={[s.chipText, condition === id && s.chipTextActive]}
                    >
                      {text}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </Field>
            <Field
              title="Descrição"
              hint="Inclua defeitos, tempo de uso e acessórios."
            >
              <TextInput
                accessibilityLabel="Descrição do produto"
                maxLength={2000}
                multiline
                textAlignVertical="top"
                style={[s.input, s.textarea]}
                value={description}
                onChangeText={setDescription}
                placeholder="O que acompanha? Tudo funciona? Conte o estado real."
                placeholderTextColor={C.dim}
              />
            </Field>
            <Field
              title="Preço em reais"
              hint="Use vírgula para centavos. Não há pagamento dentro do app."
            >
              <TextInput
                accessibilityLabel="Preço em reais"
                keyboardType="decimal-pad"
                maxLength={14}
                style={[s.input, s.priceInput]}
                value={priceInput}
                onChangeText={setPriceInput}
                placeholder="1.899,90"
                placeholderTextColor={C.dim}
              />
            </Field>
            <View style={s.locationRow}>
              <View style={s.flex}>
                <Field title="Cidade">
                  <TextInput
                    accessibilityLabel="Cidade"
                    maxLength={80}
                    style={s.input}
                    value={city}
                    onChangeText={setCity}
                  />
                </Field>
              </View>
              <View style={s.uf}>
                <Field title="UF">
                  <TextInput
                    accessibilityLabel="Estado, UF"
                    autoCapitalize="characters"
                    maxLength={2}
                    style={s.input}
                    value={state}
                    onChangeText={setState}
                  />
                </Field>
              </View>
            </View>
          </>
        ) : step === 1 ? (
          <>
            <View style={s.rowBetween}>
              <Text style={s.fieldLabel}>Fotos do produto</Text>
              <Text style={s.caption}>{photos.length + " de 5"}</Text>
            </View>
            <View style={s.photoGrid}>
              {photos.map((asset, index) => (
                <View key={asset.assetId ?? asset.uri} style={s.photoTile}>
                  <ProductImage uri={asset.uri} style={s.fill} />
                  {index === 0 ? (
                    <View style={s.coverBadge}>
                      <Text style={s.videoBadgeText}>CAPA</Text>
                    </View>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={"Remover foto " + (index + 1)}
                    style={s.removePhoto}
                    onPress={() =>
                      setPhotos((current) =>
                        current.filter((_, i) => i !== index),
                      )
                    }
                  >
                    <Text style={s.removePhotoText}>×</Text>
                  </Pressable>
                  {index > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={
                        "Usar foto " + (index + 1) + " como capa"
                      }
                      style={s.setCover}
                      onPress={() =>
                        setPhotos((current) =>
                          current[index]
                            ? [
                                current[index],
                                ...current.filter((_, i) => i !== index),
                              ]
                            : current,
                        )
                      }
                    >
                      <Text style={s.setCoverText}>Usar como capa</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {photos.length < 5 ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Adicionar fotos"
                  style={[s.photoTile, s.addPhoto]}
                  onPress={() => void pick("photos")}
                >
                  <Text style={s.addPhotoGlyph}>＋</Text>
                  <Text style={s.addPhotoText}>Adicionar foto</Text>
                </Pressable>
              ) : null}
            </View>
            <Text style={s.caption}>
              Use boa luz. Mostre frente, traseira, conexões e possíveis marcas.
            </Text>
            <View style={s.divider} />
            <Text style={s.fieldLabel}>Vídeo opcional</Text>
            <Text style={s.bodyMuted}>
              Até 30 segundos para mostrar o produto funcionando. Sem reprodução
              automática no catálogo.
            </Text>
            {video ? (
              <View style={s.videoSelected}>
                <View style={s.flex}>
                  <Text style={s.body} numberOfLines={2}>
                    {video.fileName || "Vídeo selecionado"}
                  </Text>
                  <Text style={s.caption}>
                    {video.duration
                      ? Math.ceil(video.duration / 1000) + " segundos"
                      : "Pronto para enviar"}
                  </Text>
                </View>
                <IconButton
                  label="Remover vídeo"
                  glyph="×"
                  onPress={() => setVideo(null)}
                />
              </View>
            ) : (
              <Action
                title="Selecionar vídeo"
                secondary
                onPress={() => void pick("video")}
              />
            )}
            <Notice text="Até 45 MB por envio, com no máximo 35 MB por arquivo. O servidor otimiza as fotos e o vídeo após receber os arquivos." />
          </>
        ) : (
          <>
            <View style={s.reviewCard}>
              <ProductImage uri={photos[0]?.uri} style={s.reviewImage} />
              <View style={s.productCopy}>
                <Text style={s.productCategory}>
                  {label(CATEGORIES, category)}
                </Text>
                <Text style={s.detailTitle}>{title}</Text>
                <Text style={s.productPrice}>{price(cents)}</Text>
                <Text style={s.caption}>
                  {label(CONDITIONS, condition) +
                    " · " +
                    city +
                    "/" +
                    state.toUpperCase()}
                </Text>
              </View>
            </View>
            <View style={s.reviewFacts}>
              <Text style={s.body}>
                {photos.length + " foto(s)" + (video ? " + 1 vídeo" : "")}
              </Text>
              <Text style={s.bodyMuted}>{description}</Text>
            </View>
            <Pressable
              testID="marketplace-terms"
              accessibilityRole="checkbox"
              accessibilityLabel="Confirmo a responsabilidade pelo anúncio"
              accessibilityState={{ checked: terms, disabled: busy }}
              disabled={busy}
              onPress={() => setTerms((value) => !value)}
              style={s.terms}
            >
              <View style={[s.checkbox, terms && s.checkboxOn]}>
                <Text style={s.checkText}>{terms ? "✓" : ""}</Text>
              </View>
              <Text style={s.termsText}>
                Li e aceito as regras de publicação. O produto é meu, sua venda
                é permitida e as informações são verdadeiras.
              </Text>
            </Pressable>
            <Action
              title={
                showRules
                  ? "Ocultar regras de publicação"
                  : "Ler regras de publicação"
              }
              secondary
              onPress={() => setShowRules((value) => !value)}
            />
            {showRules ? (
              <Text style={s.bodyMuted}>{MARKETPLACE_RULES}</Text>
            ) : null}
            <Notice text="A reserva não é um pagamento. Você combina pagamento e entrega diretamente com o comprador." />
          </>
        )}
        {message ? <Notice text={message} error /> : null}
        {busy ? (
          <Notice text="Enviando e processando as mídias. Mantenha o aplicativo aberto até receber a confirmação." />
        ) : null}
      </ScrollView>
      <View style={s.formDock}>
        {step > 0 ? (
          <Action
            title="Voltar"
            secondary
            disabled={busy}
            onPress={() => go(step - 1)}
          />
        ) : null}
        <View style={s.flex}>
          <Action
            testID="marketplace-form-next"
            title={
              step === 2
                ? busy
                  ? "Publicando…"
                  : "Publicar anúncio"
                : "Continuar"
            }
            busy={busy}
            onPress={step === 2 ? () => void publish() : next}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function useItems<T>(load: () => Promise<T[]>) {
  const [items, setItems] = useState<T[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const epoch = useRef(0),
    alive = useRef(true);
  const refresh = useCallback(async () => {
    const id = ++epoch.current;
    setLoading(true);
    setError("");
    try {
      const data = await load();
      if (alive.current && id === epoch.current) setItems(data);
    } catch (e) {
      if (alive.current && id === epoch.current) setError(errorText(e));
    } finally {
      if (alive.current && id === epoch.current) setLoading(false);
    }
  }, [load]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    return () => {
      alive.current = false;
      epoch.current++;
    };
  }, [refresh]);
  return { items, loading, error, refresh };
}
function MyProducts({
  onSelect,
  onSell,
  onBusy,
  onEdit,
}: {
  onSelect: (product: MarketplaceProduct) => void;
  onSell: () => void;
  onBusy: (value: boolean) => void;
  onEdit: (product: MarketplaceProduct) => void;
}) {
  const { items, loading, error, refresh } = useItems(
    loadMyMarketplaceProducts,
  );
  const [filter, setFilter] = useState("all"),
    [working, setWorking] = useState<string | null>(null),
    lock = useRef(false);
  const action = async (
    product: MarketplaceProduct,
    status: "active" | "paused" | "closed",
  ) => {
    if (lock.current) return;
    lock.current = true;
    setWorking(product.id);
    onBusy(true);
    try {
      await changeMarketplaceProductStatus(product.id, status);
      await refresh();
    } catch (e) {
      Alert.alert("Não foi possível atualizar", errorText(e));
    } finally {
      lock.current = false;
      setWorking(null);
      onBusy(false);
    }
  };
  const filtered =
    filter === "all" ? items : items.filter((p) => p.status === filter);
  return (
    <FlatList
      data={filtered}
      keyExtractor={(p) => p.id}
      contentContainerStyle={s.managementContent}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refresh}
          tintColor={C.accent}
        />
      }
      ListHeaderComponent={
        <View style={s.managementHeader}>
          <View style={s.rowBetween}>
            <View>
              <Text style={s.title}>Seu espaço de vendas</Text>
              <Text style={s.bodyMuted}>Seus produtos, no seu controle.</Text>
            </View>
          </View>
          <View style={s.stats}>
            {[
              ["À venda", items.filter((p) => p.status === "active").length],
              [
                "Reservados",
                items.filter((p) => p.status === "reserved").length,
              ],
              ["Vendidos", items.filter((p) => p.status === "sold").length],
            ].map(([text, count]) => (
              <View key={text} style={s.stat}>
                <Text style={s.statNumber}>
                  {loading || error ? "—" : count}
                </Text>
                <Text style={s.caption}>{text}</Text>
              </View>
            ))}
          </View>
          <Action
            title="+ Criar anúncio"
            onPress={onSell}
            disabled={!!working}
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipScroll}
          >
            {[
              ["all", "Todos"],
              ["active", "À venda"],
              ["paused", "Pausados"],
              ["reserved", "Reservados"],
              ["sold", "Vendidos"],
              ["closed", "Encerrados"],
            ].map(([id, text]) => (
              <Pressable
                accessibilityRole="button"
                key={id}
                style={[s.chip, filter === id && s.chipActive]}
                onPress={() => setFilter(id!)}
              >
                <Text style={[s.chipText, filter === id && s.chipTextActive]}>
                  {text}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {error ? (
            <Notice text={error} error onRetry={() => void refresh()} />
          ) : null}
        </View>
      }
      renderItem={({ item }) => (
        <View style={s.managementCard}>
          <ProductCard compact product={item} onPress={() => onSelect(item)} />
          <View style={s.managementActions}>
            <StatusPill value={item.status} />
            {working === item.id ? (
              <ActivityIndicator color={C.accent} />
            ) : null}
          </View>
          {item.moderationStatus === "hidden" ? (
            <Notice
              text={
                "Retirado pela moderação. " +
                (item.moderationReason || "Entre em contato com a LZ-GAMES.")
              }
              error
            />
          ) : null}
          {["active", "paused"].includes(item.status) &&
          item.moderationStatus !== "hidden" ? (
            <Action
              title="Editar anúncio"
              secondary
              disabled={!!working}
              onPress={() => onEdit(item)}
            />
          ) : null}
          {["active", "paused"].includes(item.status) ? (
            <View style={s.managementActions}>
              <View style={s.flex}>
                <Action
                  title={item.status === "active" ? "Pausar" : "Reativar"}
                  secondary
                  disabled={!!working}
                  onPress={() =>
                    void action(
                      item,
                      item.status === "active" ? "paused" : "active",
                    )
                  }
                />
              </View>
              <View style={s.flex}>
                <Action
                  title="Encerrar"
                  secondary
                  disabled={!!working}
                  onPress={() =>
                    Alert.alert(
                      "Encerrar anúncio?",
                      "Ele sairá do catálogo e não poderá ser reativado.",
                      [
                        { text: "Cancelar", style: "cancel" },
                        {
                          text: "Encerrar",
                          style: "destructive",
                          onPress: () => void action(item, "closed"),
                        },
                      ],
                    )
                  }
                />
              </View>
            </View>
          ) : null}
        </View>
      )}
      ListEmptyComponent={
        !loading && !error ? (
          <Empty
            title="Nenhum anúncio nesta seção"
            text="Seus produtos publicados aparecerão aqui para você acompanhar."
            action="Criar anúncio"
            onPress={onSell}
          />
        ) : null
      }
    />
  );
}
function Orders({ onBusy }: { onBusy: (value: boolean) => void }) {
  const { items, loading, error, refresh } = useItems(loadMarketplaceOrders);
  const [filter, setFilter] = useState("active"),
    [working, setWorking] = useState<string | null>(null),
    lock = useRef(false);
  const filtered = items.filter((o) =>
    filter === "active"
      ? ["requested", "accepted"].includes(o.status)
      : filter === "buyer"
        ? o.role === "buyer"
        : filter === "seller"
          ? o.role === "seller"
          : !["requested", "accepted"].includes(o.status),
  );
  const action = async (
    order: MarketplaceOrder,
    value: "accept" | "reject" | "cancel" | "complete",
  ) => {
    if (lock.current) return;
    lock.current = true;
    setWorking(order.id);
    onBusy(true);
    try {
      await changeMarketplaceOrder(order.id, value);
      await refresh();
    } catch (e) {
      Alert.alert("Não foi possível atualizar", errorText(e));
    } finally {
      lock.current = false;
      setWorking(null);
      onBusy(false);
    }
  };
  const confirm = (
    order: MarketplaceOrder,
    value: "accept" | "reject" | "cancel" | "complete",
  ) => {
    const texts = {
      accept: [
        "Aceitar reserva?",
        "O produto sairá da venda. Combine pagamento e entrega com o comprador.",
      ],
      reject: ["Recusar reserva?", "O produto voltará a ficar disponível."],
      cancel: [
        "Cancelar reserva?",
        "O produto será liberado para outros compradores.",
      ],
      complete: [
        "Negociação concluída?",
        "Confirme apenas se o produto foi entregue e o pagamento foi combinado entre vocês. O aplicativo não processa o pagamento.",
      ],
    };
    Alert.alert(texts[value][0]!, texts[value][1], [
      { text: "Voltar", style: "cancel" },
      { text: "Confirmar", onPress: () => void action(order, value) },
    ]);
  };
  const talk = async (order: MarketplaceOrder) => {
    const phone = (order.other?.whatsapp ?? "").replace(/\D/g, "");
    if (!/^\d{10,15}$/.test(phone)) {
      Alert.alert(
        "Contato indisponível",
        "Atualize as negociações e tente novamente.",
      );
      return;
    }
    try {
      await Linking.openURL(
        "https://wa.me/" +
          phone +
          "?text=" +
          encodeURIComponent(
            "Olá! Vamos conversar sobre “" +
              order.productTitle +
              "”, reserva " +
              order.id +
              ", no Games Usados da LZ-GAMES?",
          ),
      );
    } catch {
      Alert.alert(
        "Não foi possível abrir o WhatsApp",
        "Confira se há um aplicativo ou navegador disponível.",
      );
    }
  };
  return (
    <FlatList
      data={filtered}
      keyExtractor={(o) => o.id}
      contentContainerStyle={s.managementContent}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={refresh}
          tintColor={C.accent}
        />
      }
      ListHeaderComponent={
        <View style={s.managementHeader}>
          <Text style={s.title}>Suas negociações</Text>
          <Text style={s.bodyMuted}>Cada etapa, sem perder a conversa.</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.chipScroll}
          >
            {[
              ["active", "Em andamento"],
              ["buyer", "Compras"],
              ["seller", "Vendas"],
              ["history", "Histórico"],
            ].map(([id, text]) => (
              <Pressable
                accessibilityRole="button"
                key={id}
                style={[s.chip, filter === id && s.chipActive]}
                onPress={() => setFilter(id!)}
              >
                <Text style={[s.chipText, filter === id && s.chipTextActive]}>
                  {text}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {error ? (
            <Notice text={error} error onRetry={() => void refresh()} />
          ) : null}
        </View>
      }
      renderItem={({ item: order }) => (
        <View style={s.orderCard}>
          <View style={s.rowBetween}>
            <Text style={s.orderRole}>
              {order.role === "seller" ? "SUA VENDA" : "SUA COMPRA"}
            </Text>
            <StatusPill value={order.status} />
          </View>
          <Text style={s.orderTitle}>{order.productTitle}</Text>
          <Text style={s.productPrice}>{price(order.amountCents)}</Text>
          <Text selectable style={s.caption}>
            {"Reserva " + order.id}
          </Text>
          <View style={s.divider} />
          <Text style={s.body}>
            {order.other?.name ?? "Contato indisponível"}
          </Text>
          <Text style={s.bodyMuted}>
            {order.status === "requested"
              ? "Aguardando resposta do vendedor. A reserva expira em até 24 horas."
              : order.status === "accepted"
                ? "Reserva aceita. Combine pagamento e entrega diretamente."
                : order.status === "completed"
                  ? "Negociação marcada como concluída."
                  : "Esta negociação foi encerrada."}
          </Text>
          {working === order.id ? <ActivityIndicator color={C.accent} /> : null}
          {order.other?.whatsapp &&
          ["requested", "accepted"].includes(order.status) ? (
            <Action
              title="Conversar no WhatsApp"
              secondary
              disabled={!!working}
              onPress={() => void talk(order)}
            />
          ) : null}
          <View style={s.orderActions}>
            {order.role === "seller" && order.status === "requested" ? (
              <>
                <View style={s.flex}>
                  <Action
                    title="Aceitar"
                    disabled={!!working}
                    onPress={() => confirm(order, "accept")}
                  />
                </View>
                <View style={s.flex}>
                  <Action
                    title="Recusar"
                    secondary
                    disabled={!!working}
                    onPress={() => confirm(order, "reject")}
                  />
                </View>
              </>
            ) : null}
            {order.role === "buyer" && order.status === "requested" ? (
              <View style={s.flex}>
                <Action
                  title="Cancelar reserva"
                  secondary
                  disabled={!!working}
                  onPress={() => confirm(order, "cancel")}
                />
              </View>
            ) : null}
            {order.status === "accepted" ? (
              <View style={s.flex}>
                <Action
                  title="Marcar como concluída"
                  disabled={!!working}
                  onPress={() => confirm(order, "complete")}
                />
              </View>
            ) : null}
          </View>
        </View>
      )}
      ListEmptyComponent={
        !loading && !error ? (
          <Empty
            title="Nenhuma negociação nesta seção"
            text="Ao reservar um produto ou receber uma reserva, acompanhe os próximos passos aqui."
          />
        ) : null
      }
    />
  );
}

export function Marketplace({ onExit = () => {} }: { onExit?: () => void }) {
  const [accountOpen, setAccountOpen] = useState(false),
    [editing, setEditing] = useState<MarketplaceProduct | null>(null),
    [unread, setUnread] = useState(0);
  const [section, setSection] = useState<Section>("catalog"),
    [selected, setSelected] = useState<MarketplaceProduct | null>(null),
    [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true,
      inFlight = false;
    const refreshNotices = async () => {
      if (inFlight || AppState.currentState === "background") return;
      inFlight = true;
      try {
        const values = await loadMarketplaceNotices();
        if (alive) setUnread(values.filter((n) => !n.readAt).length);
      } catch {
        /* The account panel exposes retry; this badge is non-blocking. */
      } finally {
        inFlight = false;
      }
    };
    void refreshNotices();
    const timer = setInterval(() => void refreshNotices(), 60000);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshNotices();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [revision, accountOpen]);
  const dirty = useRef(false);
  const onDirty = useCallback((value: boolean) => {
    dirty.current = value;
  }, []);
  const navigate = useCallback(
    (next: () => void) => {
      if (busy) return;
      if (dirty.current)
        Alert.alert(
          "Sair do anúncio?",
          "As informações ainda não publicadas serão descartadas.",
          [
            { text: "Continuar editando", style: "cancel" },
            {
              text: "Descartar e sair",
              style: "destructive",
              onPress: () => {
                dirty.current = false;
                next();
              },
            },
          ],
        );
      else next();
    },
    [busy],
  );
  const back = useCallback(() => {
    if (busy) return;
    if (selected) {
      setSelected(null);
      return;
    }
    navigate(() => {
      if (section !== "catalog") setSection("catalog");
      else onExit();
    });
  }, [busy, selected, section, navigate, onExit]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        back();
        return true;
      },
    );
    return () => subscription.remove();
  }, [back]);
  const sell = () => navigate(() => setSection("sell"));
  const selectedTitle = selected
    ? "Detalhes do produto"
    : section === "catalog"
      ? "Games Usados"
      : section === "sell"
        ? "Novo anúncio"
        : section === "mine"
          ? "Meus anúncios"
          : "Negociações";
  return (
    <View style={s.screen}>
      {accountOpen ? (
        <AccountSheet
          onClose={() => setAccountOpen(false)}
          onChanged={() => setRevision((v) => v + 1)}
        />
      ) : null}
      {editing ? (
        <EditProductSheet
          key={editing.id}
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            setRevision((v) => v + 1);
          }}
        />
      ) : null}
      <View style={s.topBar}>
        <IconButton
          label={selected ? "Voltar" : "Voltar à LZ-GAMES"}
          glyph="‹"
          disabled={busy}
          onPress={selected ? back : () => navigate(onExit)}
        />
        <View style={s.brand}>
          <Text style={s.brandName}>
            LZ<Text style={s.brandSlash}> / </Text>GAMES
          </Text>
          <Text style={s.brandCaption}>{selectedTitle}</Text>
        </View>
        <IconButton
          label={
            "Avisos, bloqueados e regras" +
            (unread ? ", " + unread + " avisos não lidos" : "")
          }
          glyph={unread ? `● ${Math.min(unread, 99)}` : "☰"}
          disabled={busy}
          onPress={() => navigate(() => setAccountOpen(true))}
        />
      </View>
      {selected ? (
        <ProductDetails
          key={selected.id}
          initial={selected}
          onBack={back}
          onBusy={setBusy}
          onBlocked={() => {
            setSelected(null);
            setRevision((value) => value + 1);
          }}
          onReserved={() => {
            setSelected(null);
            setSection("orders");
            setRevision((value) => value + 1);
          }}
        />
      ) : section === "catalog" ? (
        <Catalog
          key={"catalog" + revision}
          onSelect={setSelected}
          onSell={sell}
        />
      ) : section === "sell" ? (
        <SellerForm
          onDirty={onDirty}
          onBusy={setBusy}
          onCreated={() => {
            dirty.current = false;
            setRevision((value) => value + 1);
            setSection("mine");
          }}
        />
      ) : section === "mine" ? (
        <MyProducts
          key={"mine" + revision}
          onSelect={(product) => {
            if (!busy) setSelected(product);
          }}
          onSell={sell}
          onBusy={setBusy}
          onEdit={(product) => setEditing(product)}
        />
      ) : (
        <Orders key={"orders" + revision} onBusy={setBusy} />
      )}
      {!selected ? (
        <View style={s.shopNav}>
          {(
            [
              ["catalog", "Explorar", "▦"],
              ["sell", "Anunciar", "＋"],
              ["mine", "Meus anúncios", "▤"],
              ["orders", "Negociações", "⇄"],
            ] as [Section, string, string][]
          ).map(([id, title, glyph]) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityLabel={title}
              accessibilityState={{ selected: section === id, disabled: busy }}
              disabled={busy}
              key={id}
              onPress={() => {
                if (section !== id) navigate(() => setSection(id));
              }}
              style={({ pressed }) => [s.navItem, pressed && s.pressed]}
            >
              <View style={[s.navIconBox, section === id && s.navIconBoxOn]}>
                <Text style={[s.navGlyph, section === id && s.navActive]}>
                  {glyph}
                </Text>
              </View>
              <Text style={[s.navLabel, section === id && s.navActive]}>
                {title}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  screen: {
    flex: 1,
    width: "100%",
    maxWidth: 900,
    alignSelf: "center",
    backgroundColor: C.bg,
    paddingTop:
      Platform.OS === "android" ? (NativeStatusBar.currentHeight ?? 24) : 0,
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  brand: { flex: 1, gap: 2 },
  brandName: {
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1.6,
    color: C.text,
  },
  brandSlash: { color: C.accent },
  brandCaption: { fontSize: 12, color: C.muted },
  headerBadge: {
    borderWidth: 1,
    borderColor: C.line,
    padding: 7,
    borderRadius: 6,
    marginRight: 12,
  },
  headerBadgeText: {
    fontSize: 10,
    letterSpacing: 1.2,
    fontWeight: "800",
    color: C.accent,
  },
  iconButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
  },
  iconGlyph: { fontSize: 30, color: C.text, lineHeight: 36 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.45 },
  title: {
    color: C.text,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: "800",
    flexShrink: 1,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 23,
    color: C.text,
    fontWeight: "700",
    flexShrink: 1,
  },
  body: { fontSize: 14, lineHeight: 21, color: C.text },
  bodyMuted: { fontSize: 14, lineHeight: 21, color: C.muted },
  caption: { fontSize: 12, lineHeight: 18, color: C.muted },
  eyebrow: {
    fontSize: 10,
    lineHeight: 16,
    fontWeight: "800",
    letterSpacing: 1.4,
    color: C.accent,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 8 },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: C.accent,
    borderWidth: 1,
    borderColor: C.accent,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonText: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    textAlign: "center",
    color: C.bg,
  },
  buttonSecondary: { backgroundColor: C.surface, borderColor: C.line },
  buttonSecondaryText: { color: C.text },
  searchArea: { paddingTop: 14, borderBottomWidth: 1, borderColor: C.line },
  searchBox: {
    marginHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
  },
  searchGlyph: { fontSize: 28, color: C.accent, marginLeft: 12 },
  searchInput: {
    flex: 1,
    minWidth: 40,
    color: C.text,
    fontSize: 14,
    minHeight: 52,
    paddingHorizontal: 10,
  },
  filterButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderLeftWidth: 1,
    borderLeftColor: C.line,
  },
  filterText: { fontSize: 12, color: C.accent, fontWeight: "700" },
  quickCategories: { paddingHorizontal: 18, gap: 20 },
  categoryTab: {
    minHeight: 50,
    justifyContent: "center",
    borderBottomWidth: 2,
    borderColor: "transparent",
  },
  categoryTabOn: { borderColor: C.accent },
  categoryText: { fontSize: 13, color: C.muted },
  categoryTextOn: { fontWeight: "700", color: C.accent },
  appliedFilters: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  catalogContent: { padding: 18, paddingBottom: 16 },
  catalogHeader: { gap: 8, marginBottom: 16 },
  hero: {
    backgroundColor: "#162c37",
    borderWidth: 1,
    borderColor: "#2c4b59",
    borderRadius: 20,
    minHeight: 175,
    overflow: "hidden",
    flexDirection: "row",
    marginBottom: 14,
  },
  heroCopy: { flex: 1, padding: 18, paddingRight: 0, zIndex: 1 },
  heroTitle: {
    fontSize: 31,
    lineHeight: 34,
    letterSpacing: -0.8,
    color: C.text,
    fontWeight: "900",
    marginTop: 10,
  },
  heroText: { fontSize: 12, color: "#bdd9df", marginTop: 10 },
  controllerArt: {
    width: 128,
    alignSelf: "stretch",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  orbit: {
    position: "absolute",
    width: 148,
    height: 148,
    borderRadius: 74,
    borderWidth: 1,
    borderColor: "#42626f",
    right: -27,
    top: 10,
  },
  controllerBody: {
    width: 110,
    height: 72,
    backgroundColor: "#d1dde1",
    borderRadius: 28,
    transform: [{ rotate: "-17deg" }],
    borderBottomWidth: 7,
    borderColor: "#758b99",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
  },
  dpadH: {
    position: "absolute",
    width: 26,
    height: 9,
    borderRadius: 2,
    backgroundColor: "#304354",
    left: 15,
    top: 23,
  },
  dpadV: {
    position: "absolute",
    width: 9,
    height: 26,
    borderRadius: 2,
    backgroundColor: "#304354",
    left: 23,
    top: 15,
  },
  padDot1: {
    position: "absolute",
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#3a7a85",
    right: 14,
    top: 15,
  },
  padDot2: {
    position: "absolute",
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#3a7a85",
    right: 26,
    top: 27,
  },
  padStick1: {
    position: "absolute",
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "#465765",
    left: 39,
    bottom: 10,
  },
  padStick2: {
    position: "absolute",
    width: 15,
    height: 15,
    borderRadius: 8,
    backgroundColor: "#465765",
    right: 31,
    bottom: 8,
  },
  artTag: {
    position: "absolute",
    bottom: 16,
    right: 10,
    borderWidth: 1,
    borderColor: "#456370",
    borderRadius: 5,
    padding: 5,
  },
  artTagText: {
    fontSize: 8,
    color: "#b4d5df",
    letterSpacing: 0.7,
    fontWeight: "800",
  },
  gridRow: { gap: 12 },
  gridItem: { flex: 1, maxWidth: "100%", marginBottom: 12 },
  product: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    overflow: "hidden",
  },
  productMedia: { width: "100%", aspectRatio: 1, backgroundColor: "#202936" },
  fill: { width: "100%", height: "100%" },
  productCopy: { padding: 12, gap: 5, flex: 1 },
  productCategory: {
    fontSize: 11,
    lineHeight: 16,
    color: C.accent,
    fontWeight: "600",
  },
  productTitle: {
    fontSize: 14,
    lineHeight: 20,
    minHeight: 40,
    fontWeight: "600",
    color: C.text,
  },
  productPrice: {
    fontSize: 21,
    lineHeight: 29,
    fontWeight: "800",
    color: C.text,
    letterSpacing: -0.5,
  },
  videoBadge: {
    position: "absolute",
    bottom: 8,
    left: 8,
    backgroundColor: "#101a27ed",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 7,
  },
  videoBadgeText: { fontSize: 10, fontWeight: "700", color: "#fff" },
  imageFallback: {
    backgroundColor: "#202936",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  imageFallbackBrand: {
    color: "#5e788c",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 2,
  },
  skeletonGrid: { flexDirection: "row", gap: 12 },
  skeletonCard: {
    flex: 1,
    backgroundColor: C.surface,
    borderRadius: 16,
    overflow: "hidden",
  },
  skeletonPhoto: { height: 155, backgroundColor: C.raised },
  skeletonLine: {
    height: 12,
    backgroundColor: C.raised,
    margin: 12,
    borderRadius: 4,
    width: "75%",
  },
  listFooter: { gap: 18, paddingTop: 8, paddingBottom: 20 },
  footerText: { textAlign: "center", color: C.muted, fontSize: 12 },
  safetyCaption: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 19,
    color: C.dim,
    paddingHorizontal: 15,
  },
  empty: {
    paddingVertical: 32,
    paddingHorizontal: 18,
    alignItems: "center",
    gap: 12,
  },
  emptyArt: {
    height: 85,
    width: 90,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyBox: {
    height: 52,
    width: 52,
    borderWidth: 2,
    borderColor: "#56798c",
    borderRadius: 12,
    transform: [{ rotate: "-10deg" }],
  },
  emptySpark: {
    position: "absolute",
    height: 13,
    width: 13,
    borderRadius: 4,
    backgroundColor: C.accent,
    right: 10,
    top: 8,
    transform: [{ rotate: "20deg" }],
  },
  emptyTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "700",
    color: C.text,
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    color: C.muted,
    marginBottom: 5,
    maxWidth: 350,
  },
  notice: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "#192c36",
    gap: 10,
    borderWidth: 1,
    borderColor: "#304b57",
  },
  noticeText: { color: "#c1d9e4", fontSize: 13, lineHeight: 20 },
  noticeError: { backgroundColor: "#321f29", borderColor: "#67404c" },
  errorText: { color: C.danger },
  modalShade: { flex: 1, backgroundColor: "#0009", justifyContent: "flex-end" },
  modalBackdrop: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 },
  sheet: {
    backgroundColor: C.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "88%",
    borderWidth: 1,
    borderColor: C.line,
    paddingBottom: Platform.OS === "android" ? 42 : 30,
  },
  sheetHandle: {
    width: 38,
    height: 4,
    alignSelf: "center",
    backgroundColor: C.line,
    borderRadius: 3,
    marginBottom: 12,
  },
  sheetContent: { gap: 18, paddingVertical: 15 },
  sheetActions: { flexDirection: "row", gap: 12, paddingTop: 18 },
  sheetHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
  chip: {
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    justifyContent: "center",
    backgroundColor: C.surface,
  },
  chipActive: { backgroundColor: "#213f45", borderColor: C.accent },
  chipText: { fontSize: 13, color: C.muted, lineHeight: 20 },
  chipTextActive: { color: C.accent, fontWeight: "700" },
  chipScroll: { gap: 8, paddingVertical: 8 },
  shopNav: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderColor: C.line,
    backgroundColor: "#101720",
    paddingTop: 8,
    paddingBottom: Platform.OS === "android" ? 38 : 12,
  },
  navItem: { flex: 1, alignItems: "center", minHeight: 58, gap: 3 },
  navIconBox: {
    minWidth: 50,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
  },
  navIconBoxOn: { backgroundColor: "#203d43" },
  navGlyph: { fontSize: 23, color: C.dim },
  navLabel: {
    fontSize: 11,
    lineHeight: 16,
    color: C.muted,
    textAlign: "center",
  },
  navActive: { color: C.accent, fontWeight: "700" },
  detailContent: { paddingBottom: 22 },
  gallery: { backgroundColor: "#121a24", position: "relative" },
  noGallery: { height: 200, alignItems: "center", justifyContent: "center" },
  photoCounter: {
    position: "absolute",
    bottom: 12,
    alignSelf: "center",
    backgroundColor: "#0b1018e8",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  photoCounterText: { color: C.text, fontSize: 11 },
  detailCopy: { padding: 20, gap: 14 },
  detailTitle: {
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "700",
    color: C.text,
  },
  detailPrice: {
    fontSize: 33,
    lineHeight: 40,
    fontWeight: "800",
    letterSpacing: -1,
    color: C.text,
  },
  infoChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 7,
    backgroundColor: C.raised,
  },
  description: { fontSize: 15, lineHeight: 24, color: "#c6d2df" },
  seller: {
    flexDirection: "row",
    gap: 12,
    padding: 15,
    backgroundColor: C.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#2a4252",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 19, fontWeight: "800", color: C.accent },
  sellerName: {
    color: C.text,
    fontSize: 16,
    fontWeight: "700",
    marginVertical: 3,
  },
  safety: {
    gap: 8,
    padding: 15,
    backgroundColor: "#24261e",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#464a35",
  },
  safetyTitle: {
    color: C.gold,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
  },
  purchaseDock: {
    flexDirection: "row",
    gap: 12,
    padding: 18,
    paddingBottom: Platform.OS === "android" ? 44 : 18,
    borderTopWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
    alignItems: "center",
  },
  dockPrice: { color: C.text, fontSize: 22, fontWeight: "800" },
  pill: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 7 },
  pillGood: { backgroundColor: "#22433a" },
  pillWarm: { backgroundColor: "#443d28" },
  pillNeutral: { backgroundColor: "#303b48" },
  pillText: { fontSize: 11, lineHeight: 16, fontWeight: "600", color: C.text },
  videoPanel: { gap: 10 },
  videoPreview: {
    height: 190,
    backgroundColor: C.surface,
    borderRadius: 14,
    overflow: "hidden",
  },
  videoPlay: {
    position: "absolute",
    top: 65,
    alignSelf: "center",
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  videoPlayText: { fontSize: 20, color: C.bg },
  detailVideo: {
    height: 230,
    width: "100%",
    backgroundColor: "#000",
    borderRadius: 12,
  },
  fullscreen: {
    flex: 1,
    backgroundColor: "#05090f",
    paddingTop:
      Platform.OS === "android" ? (NativeStatusBar.currentHeight ?? 24) : 45,
    paddingBottom: 40,
  },
  fullscreenHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  fullscreenImage: { flex: 1, width: "100%" },
  fullscreenControls: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  steps: {
    flexDirection: "row",
    paddingHorizontal: 18,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderColor: C.line,
  },
  step: { flex: 1, alignItems: "center", gap: 6 },
  stepNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: C.raised,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberOn: { backgroundColor: C.accent },
  stepDigit: { fontSize: 12, fontWeight: "800", color: C.muted },
  stepDigitOn: { color: C.bg },
  stepLabel: { fontSize: 12, color: C.dim },
  stepLabelOn: { color: C.text, fontWeight: "700" },
  formContent: { padding: 20, gap: 22, paddingBottom: 35 },
  field: { gap: 9 },
  fieldLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: C.text,
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 22,
    color: C.text,
    backgroundColor: C.surface,
  },
  textarea: { minHeight: 120 },
  priceInput: { fontSize: 23, fontWeight: "700" },
  locationRow: { flexDirection: "row", gap: 12 },
  uf: { width: 76 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoTile: {
    width: "47%",
    aspectRatio: 1,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: C.surface,
  },
  addPhoto: {
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: C.accent,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  addPhotoGlyph: { fontSize: 35, color: C.accent },
  addPhotoText: { fontSize: 13, color: C.accent, fontWeight: "700" },
  coverBadge: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: "#142631ee",
    borderRadius: 5,
    padding: 5,
  },
  removePhoto: {
    position: "absolute",
    right: 0,
    top: 0,
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  removePhotoText: {
    fontSize: 26,
    color: "#fff",
    backgroundColor: "#151b25e8",
    borderRadius: 16,
    textAlign: "center",
    width: 32,
    height: 32,
    lineHeight: 30,
  },
  setCover: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#142631e8",
  },
  setCoverText: { fontSize: 12, fontWeight: "700", color: C.text },
  videoSelected: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: 12,
  },
  reviewCard: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: C.surface,
  },
  reviewImage: { width: "100%", aspectRatio: 1.5 },
  reviewFacts: { gap: 12 },
  terms: {
    flexDirection: "row",
    gap: 12,
    minHeight: 48,
    alignItems: "flex-start",
  },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: C.dim,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: C.accent, borderColor: C.accent },
  checkText: { fontSize: 17, fontWeight: "800", color: C.bg },
  termsText: { flex: 1, color: C.muted, fontSize: 13, lineHeight: 21 },
  formDock: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderColor: C.line,
    backgroundColor: C.bg,
  },
  managementContent: { padding: 18, paddingBottom: 28 },
  managementHeader: { gap: 14, marginBottom: 18 },
  stats: {
    flexDirection: "row",
    padding: 16,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    backgroundColor: C.surface,
  },
  stat: { flex: 1, gap: 4, alignItems: "center" },
  statNumber: { fontSize: 24, fontWeight: "800", color: C.text },
  managementCard: {
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    backgroundColor: C.surface,
    marginBottom: 16,
    overflow: "hidden",
  },
  productCompact: { flexDirection: "row", borderWidth: 0, borderRadius: 0 },
  compactMedia: { width: 105, height: 130 },
  managementActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  orderCard: {
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 16,
    backgroundColor: C.surface,
    marginBottom: 14,
  },
  orderRole: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.1,
    color: C.accent,
  },
  orderTitle: {
    fontSize: 19,
    lineHeight: 26,
    fontWeight: "700",
    color: C.text,
  },
  orderActions: { flexDirection: "row", gap: 10 },
});
