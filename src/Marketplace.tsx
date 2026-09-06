import * as ImagePicker from 'expo-image-picker';
import {useVideoPlayer,VideoView} from 'expo-video';
import React,{useEffect,useMemo,useState} from 'react';
import {ActivityIndicator,Alert,Image,Linking,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {
  MarketplaceOrder,MarketplaceProduct,MarketplaceUploadAsset,changeMarketplaceOrder,changeMarketplaceProductStatus,
  createMarketplaceProduct,loadMarketplace,loadMarketplaceOrders,loadMyMarketplaceProducts,reportMarketplaceProduct,requestMarketplacePurchase,
} from './api';
import {NeonCard} from './effects/Neon';

type Section='catalog'|'sell'|'mine'|'orders';
const CATEGORIES=[
  ['','Todos'],['consoles','Consoles'],['jogos','Jogos'],['controles','Controles'],['acessorios','Acessórios'],
  ['computadores','Computadores'],['componentes','Componentes'],['colecionaveis','Colecionáveis'],['outros','Outros'],
] as const;
const CONDITIONS=[['used_like_new','Como novo'],['used_good','Bom estado'],['used_fair','Marcas de uso']] as const;
const STATUS:Record<string,string>={active:'ATIVO',paused:'PAUSADO',reserved:'RESERVADO',sold:'VENDIDO',closed:'ENCERRADO',requested:'SOLICITADO',accepted:'ACEITO',rejected:'RECUSADO',cancelled:'CANCELADO',completed:'CONCLUÍDO'};
const price=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const conditionLabel=(value:string)=>CONDITIONS.find(item=>item[0]===value)?.[1]??'Usado';
const categoryLabel=(value:string)=>CATEGORIES.find(item=>item[0]===value)?.[1]??'Outros';
const errorText=(error:unknown)=>error instanceof Error?error.message:'Não foi possível concluir a operação.';

function ProductVideo({uri}:{uri:string}){
  const player=useVideoPlayer(uri,current=>{current.loop=true;});
  return <VideoView player={player} nativeControls contentFit="contain" style={s.detailVideo}/>;
}

function Empty({children}:{children:string}){
  return <View style={s.empty}><Text style={s.emptyIcon}>◇</Text><Text style={s.emptyText}>{children}</Text></View>;
}

function StatusPill({value}:{value:string}){
  return <View style={[s.statusPill,value==='active'||value==='completed'?s.statusGood:value==='reserved'||value==='requested'?s.statusWarn:s.statusMuted]}><Text style={s.statusText}>{STATUS[value]??value.toUpperCase()}</Text></View>;
}

function ProductCard({product,onPress}:{product:MarketplaceProduct;onPress:()=>void}){
  const cover=product.media.find(item=>item.kind==='image')?.url;
  return <NeonCard color="#70d8ff" radius={16} style={s.productCard} onPress={onPress} accessibilityRole="button" accessibilityLabel={`${product.title}, ${price(product.priceCents)}`}>
    {cover?<Image source={{uri:cover}} style={s.productImage}/>:<View style={[s.productImage,s.noImage]}><Text style={s.noImageText}>LZ</Text></View>}
    <View style={s.productBody}>
      <View style={s.productMetaRow}><Text style={s.productCategory}>{categoryLabel(product.category).toUpperCase()}</Text>{product.isMine?<Text style={s.mineTag}>SEU ANÚNCIO</Text>:null}</View>
      <Text numberOfLines={2} style={s.productTitle}>{product.title}</Text>
      <Text style={s.productPrice}>{price(product.priceCents)}</Text>
      <Text numberOfLines={1} style={s.productMeta}>{conditionLabel(product.condition)} · {product.city}/{product.state}</Text>
    </View>
  </NeonCard>;
}

function Catalog({onSelect}:{onSelect:(product:MarketplaceProduct)=>void}){
  const [query,setQuery]=useState(''),[category,setCategory]=useState(''),[products,setProducts]=useState<MarketplaceProduct[]>([]);
  const [loading,setLoading]=useState(true),[message,setMessage]=useState('');
  const refresh=async()=>{setLoading(true);setMessage('');try{setProducts((await loadMarketplace({query,category})).products);}catch(error){setMessage(errorText(error));}finally{setLoading(false);}};
  useEffect(()=>{const timer=setTimeout(()=>void refresh(),query?450:0);return()=>clearTimeout(timer);},[query,category]);
  return <View style={s.section}>
    <Text style={s.sectionTitle}>Games Usados</Text><Text style={s.sectionText}>Compre de clientes cadastrados e venda seus produtos com segurança.</Text>
    <View style={s.searchRow}><TextInput value={query} onChangeText={setQuery} style={s.search} placeholder="Buscar console, jogo, controle..." placeholderTextColor="#667c86" returnKeyType="search" onSubmitEditing={refresh}/><Pressable style={s.searchButton} onPress={refresh}><Text style={s.searchButtonText}>⌕</Text></Pressable></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>{CATEGORIES.map(item=><Pressable key={item[0]||'all'} style={[s.chip,category===item[0]&&s.chipOn]} onPress={()=>setCategory(item[0])}><Text style={[s.chipText,category===item[0]&&s.chipTextOn]}>{item[1]}</Text></Pressable>)}</ScrollView>
    {message?<Text style={s.error}>{message}</Text>:null}
    {loading?<ActivityIndicator color="#70d8ff" style={s.loader}/>:products.length?products.map(product=><ProductCard key={product.id} product={product} onPress={()=>onSelect(product)}/>):<Empty>Nenhum produto encontrado com estes filtros.</Empty>}
  </View>;
}

function ProductDetails({product,onBack,onChanged}:{product:MarketplaceProduct;onBack:()=>void;onChanged:()=>void}){
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const images=product.media.filter(item=>item.kind==='image'),video=product.media.find(item=>item.kind==='video');
  const buy=()=>Alert.alert('Reservar produto',`Deseja reservar “${product.title}” por ${price(product.priceCents)}? A reserva vale por 24 horas.`,[{text:'Agora não',style:'cancel'},{text:'RESERVAR',onPress:async()=>{
    setBusy(true);setMessage('');try{const order=await requestMarketplacePurchase(product.id);setMessage(`Reserva ${order.publicCode} criada.`);onChanged();if(order.seller?.whatsapp){const text=encodeURIComponent(`Olá, ${order.seller.name}! Tenho interesse no produto “${product.title}” anunciado no Games Usados da LZ-GAMES. Minha reserva é ${order.publicCode}.`);Alert.alert('Produto reservado','O item saiu temporariamente do catálogo. Fale com o vendedor para combinar pagamento e entrega.',[{text:'DEPOIS'},{text:'ABRIR WHATSAPP',onPress:()=>Linking.openURL(`https://wa.me/${order.seller!.whatsapp}?text=${text}`)}]);}}
    catch(error){setMessage(errorText(error));}finally{setBusy(false);}
  }}]);
  const report=()=>Alert.alert('Denunciar anúncio','Informe a LZ-GAMES se este anúncio tiver informação incorreta ou conteúdo inadequado.',[{text:'Cancelar',style:'cancel'},{text:'DENUNCIAR',style:'destructive',onPress:async()=>{setBusy(true);try{await reportMarketplaceProduct(product.id);setMessage('Denúncia registrada para análise.');}catch(error){setMessage(errorText(error));}finally{setBusy(false);}}}]);
  return <View style={s.section}>
    <Pressable onPress={onBack} style={s.back}><Text style={s.backText}>← VOLTAR AO CATÁLOGO</Text></Pressable>
    <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={s.gallery}>{images.map(item=><Image key={item.id} source={{uri:item.url}} resizeMode="contain" style={s.detailImage}/>)}</ScrollView>
    {video?<View style={s.videoBox}><Text style={s.videoLabel}>VÍDEO DO PRODUTO · ATÉ 30 SEGUNDOS</Text><ProductVideo uri={video.url}/></View>:null}
    <View style={s.detailBody}><View style={s.detailHeading}><Text style={s.productCategory}>{categoryLabel(product.category).toUpperCase()}</Text><StatusPill value={product.status}/></View>
      <Text style={s.detailTitle}>{product.title}</Text><Text style={s.detailPrice}>{price(product.priceCents)}</Text>
      <Text style={s.detailMeta}>{conditionLabel(product.condition)} · {product.city}/{product.state}</Text>
      <View style={s.rule}/><Text style={s.detailLabel}>DESCRIÇÃO</Text><Text style={s.description}>{product.description}</Text>
      <View style={s.sellerBox}><Text style={s.detailLabel}>VENDEDOR CADASTRADO</Text><Text style={s.sellerName}>{product.seller.name}</Text><Text style={s.privacy}>O WhatsApp só é liberado após a reserva.</Text></View>
      {message?<Text style={s.message}>{message}</Text>:null}
      {!product.isMine&&product.status==='active'?<Pressable disabled={busy} onPress={buy} style={s.buyButton}>{busy?<ActivityIndicator color="#03130d"/>:<Text style={s.buyText}>RESERVAR E FALAR COM O VENDEDOR</Text>}</Pressable>:null}
      {!product.isMine?<Pressable disabled={busy} onPress={report} style={s.reportButton}><Text style={s.reportText}>DENUNCIAR ANÚNCIO</Text></Pressable>:null}
    </View>
  </View>;
}

function SellerForm({onCreated}:{onCreated:()=>void}){
  const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[category,setCategory]=useState('jogos'),[condition,setCondition]=useState('used_good');
  const [priceInput,setPriceInput]=useState(''),[city,setCity]=useState('Maceió'),[state,setState]=useState('AL');
  const [photos,setPhotos]=useState<ImagePicker.ImagePickerAsset[]>([]),[video,setVideo]=useState<ImagePicker.ImagePickerAsset|null>(null);
  const [terms,setTerms]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const pickPhotos=async()=>{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,selectionLimit:5-photos.length,orderedSelection:true,quality:.9});if(!result.canceled)setPhotos(current=>[...current,...result.assets].slice(0,5));};
  const pickVideo=async()=>{const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['videos'],allowsMultipleSelection:false,quality:1,videoMaxDuration:30});if(result.canceled)return;const selected=result.assets[0];if(!selected)return;if(selected.duration&&selected.duration>30750){setMessage('Escolha um vídeo de no máximo 30 segundos.');return;}setVideo(selected);setMessage('');};
  const cents=useMemo(()=>{const raw=priceInput.trim().replace(/\s/g,'').replace(/^R\$/i,'');if(!raw)return 0;const normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.') : raw;const number=Number(normalized);return Number.isFinite(number)?Math.round(number*100):0;},[priceInput]);
  const publish=async()=>{
    if(title.trim().length<3)return setMessage('Informe um título claro para o produto.');
    if(description.trim().length<10)return setMessage('Descreva o produto e seu estado com pelo menos 10 caracteres.');
    if(cents<100)return setMessage('Informe um preço válido, a partir de R$ 1,00.');
    if(!photos.length)return setMessage('Adicione ao menos uma foto real do produto.');
    if(!city.trim()||!/^[A-Za-z]{2}$/.test(state.trim()))return setMessage('Informe cidade e UF.');
    if(!terms)return setMessage('Confirme que o produto é seu e que as informações são verdadeiras.');
    setBusy(true);setMessage('Comprimindo e publicando as mídias…');
    try{
      await createMarketplaceProduct({title:title.trim(),description:description.trim(),category,condition,priceCents:cents,city:city.trim(),state:state.trim().toUpperCase(),photos:photos.map(asset=>asset as MarketplaceUploadAsset),video:video as MarketplaceUploadAsset|null});
      setMessage('Anúncio publicado com sucesso.');setTitle('');setDescription('');setPriceInput('');setPhotos([]);setVideo(null);setTerms(false);onCreated();
    }catch(error){setMessage(errorText(error));}finally{setBusy(false);}
  };
  return <View style={s.section}><Text style={s.sectionTitle}>Vender produto</Text><Text style={s.sectionText}>As fotos e o vídeo serão comprimidos no servidor para deixar o aplicativo leve.</Text>
    <Text style={s.label}>TÍTULO</Text><TextInput maxLength={80} style={s.input} value={title} onChangeText={setTitle} placeholder="Ex.: PlayStation 5 com dois controles" placeholderTextColor="#667c86"/>
    <Text style={s.label}>DESCRIÇÃO E ESTADO REAL</Text><TextInput maxLength={2000} multiline textAlignVertical="top" style={[s.input,s.textarea]} value={description} onChangeText={setDescription} placeholder="Conte o tempo de uso, defeitos, acessórios e o que acompanha." placeholderTextColor="#667c86"/>
    <Text style={s.label}>CATEGORIA</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>{CATEGORIES.slice(1).map(item=><Pressable key={item[0]} style={[s.chip,category===item[0]&&s.chipOn]} onPress={()=>setCategory(item[0])}><Text style={[s.chipText,category===item[0]&&s.chipTextOn]}>{item[1]}</Text></Pressable>)}</ScrollView>
    <Text style={s.label}>CONSERVAÇÃO</Text><View style={s.optionRow}>{CONDITIONS.map(item=><Pressable key={item[0]} style={[s.option,condition===item[0]&&s.optionOn]} onPress={()=>setCondition(item[0])}><Text style={[s.optionText,condition===item[0]&&s.optionTextOn]}>{item[1]}</Text></Pressable>)}</View>
    <View style={s.twoColumns}><View style={s.column}><Text style={s.label}>PREÇO</Text><TextInput keyboardType="decimal-pad" style={s.input} value={priceInput} onChangeText={setPriceInput} placeholder="Ex.: 1.899,90" placeholderTextColor="#667c86"/></View><View style={s.ufColumn}><Text style={s.label}>UF</Text><TextInput autoCapitalize="characters" maxLength={2} style={s.input} value={state} onChangeText={setState} placeholder="AL" placeholderTextColor="#667c86"/></View></View>
    <Text style={s.label}>CIDADE</Text><TextInput maxLength={80} style={s.input} value={city} onChangeText={setCity} placeholder="Cidade" placeholderTextColor="#667c86"/>
    <Text style={s.label}>FOTOS · {photos.length}/5</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.mediaRow}>{photos.map((asset,index)=><View key={`${asset.assetId??asset.uri}-${index}`} style={s.previewBox}><Image source={{uri:asset.uri}} style={s.preview}/><Pressable accessibilityLabel={`Remover foto ${index+1}`} style={s.remove} onPress={()=>setPhotos(current=>current.filter((_,i)=>i!==index))}><Text style={s.removeText}>×</Text></Pressable></View>)}{photos.length<5?<Pressable onPress={pickPhotos} style={s.addMedia}><Text style={s.addMediaIcon}>＋</Text><Text style={s.addMediaText}>ADICIONAR</Text></Pressable>:null}</ScrollView>
    <Text style={s.label}>VÍDEO OPCIONAL · MÁXIMO 30 SEGUNDOS</Text>{video?<View style={s.videoSelected}><Text numberOfLines={1} style={s.videoSelectedText}>▶ {video.fileName||'Vídeo selecionado'}</Text><Pressable onPress={()=>setVideo(null)}><Text style={s.removeVideo}>REMOVER</Text></Pressable></View>:<Pressable onPress={pickVideo} style={s.videoPicker}><Text style={s.videoPickerText}>SELECIONAR VÍDEO CURTO</Text></Pressable>}
    <Pressable onPress={()=>setTerms(value=>!value)} style={s.termsRow}><View style={[s.checkbox,terms&&s.checkboxOn]}><Text style={s.check}>{terms?'✓':''}</Text></View><Text style={s.termsText}>Confirmo que o produto é meu, é permitido por lei e que preço, fotos e descrição são verdadeiros.</Text></Pressable>
    {message?<Text style={s.message}>{message}</Text>:null}<Pressable disabled={busy} onPress={publish} style={[s.publish,busy&&s.disabledButton]}>{busy?<ActivityIndicator color="#04130d"/>:<Text style={s.publishText}>PUBLICAR PRODUTO</Text>}</Pressable>
  </View>;
}

function MyProducts({refreshKey,onSelect}:{refreshKey:number;onSelect:(product:MarketplaceProduct)=>void}){
  const [products,setProducts]=useState<MarketplaceProduct[]>([]),[loading,setLoading]=useState(true),[message,setMessage]=useState('');
  const refresh=async()=>{setLoading(true);try{setProducts(await loadMyMarketplaceProducts());setMessage('');}catch(error){setMessage(errorText(error));}finally{setLoading(false);}};
  useEffect(()=>{void refresh();},[refreshKey]);
  const action=async(product:MarketplaceProduct,status:'active'|'paused'|'closed')=>{try{await changeMarketplaceProductStatus(product.id,status);await refresh();}catch(error){setMessage(errorText(error));}};
  return <View style={s.section}><View style={s.headingRow}><View><Text style={s.sectionTitle}>Meus anúncios</Text><Text style={s.sectionText}>Controle o que está à venda.</Text></View><Pressable onPress={refresh}><Text style={s.refresh}>ATUALIZAR</Text></Pressable></View>{message?<Text style={s.error}>{message}</Text>:null}{loading?<ActivityIndicator color="#70d8ff" style={s.loader}/>:products.length?products.map(product=><View key={product.id}><ProductCard product={product} onPress={()=>onSelect(product)}/><View style={s.actions}><StatusPill value={product.status}/>{product.status==='active'?<Pressable onPress={()=>action(product,'paused')} style={s.secondaryButton}><Text style={s.secondaryText}>PAUSAR</Text></Pressable>:product.status==='paused'?<Pressable onPress={()=>action(product,'active')} style={s.secondaryButton}><Text style={s.secondaryText}>REATIVAR</Text></Pressable>:null}{['active','paused'].includes(product.status)?<Pressable onPress={()=>Alert.alert('Encerrar anúncio','Depois de encerrado, ele não poderá ser reativado.',[{text:'Cancelar'},{text:'ENCERRAR',style:'destructive',onPress:()=>action(product,'closed')}])} style={s.secondaryButton}><Text style={s.dangerText}>ENCERRAR</Text></Pressable>:null}</View></View>):<Empty>Você ainda não publicou produtos.</Empty>}</View>;
}

function Orders({refreshKey}:{refreshKey:number}){
  const [orders,setOrders]=useState<MarketplaceOrder[]>([]),[loading,setLoading]=useState(true),[message,setMessage]=useState('');
  const refresh=async()=>{setLoading(true);try{setOrders(await loadMarketplaceOrders());setMessage('');}catch(error){setMessage(errorText(error));}finally{setLoading(false);}};
  useEffect(()=>{void refresh();},[refreshKey]);
  const action=async(order:MarketplaceOrder,value:'accept'|'reject'|'cancel'|'complete')=>{try{await changeMarketplaceOrder(order.id,value);await refresh();}catch(error){setMessage(errorText(error));}};
  const talk=(order:MarketplaceOrder)=>{if(!order.other?.whatsapp)return;const text=encodeURIComponent(`Olá, ${order.other.name}! Estou falando sobre “${order.productTitle}”, negociação ${order.id}, no Games Usados da LZ-GAMES.`);void Linking.openURL(`https://wa.me/${order.other.whatsapp}?text=${text}`);};
  return <View style={s.section}><View style={s.headingRow}><View><Text style={s.sectionTitle}>Negociações</Text><Text style={s.sectionText}>Compras e vendas em andamento.</Text></View><Pressable onPress={refresh}><Text style={s.refresh}>ATUALIZAR</Text></Pressable></View>{message?<Text style={s.error}>{message}</Text>:null}{loading?<ActivityIndicator color="#70d8ff" style={s.loader}/>:orders.length?orders.map(order=><NeonCard key={order.id} color="#b29aff" radius={16} style={s.orderCard}><View style={s.orderHeading}><View style={s.orderTitleBox}><Text style={s.orderRole}>{order.role==='seller'?'VOCÊ ESTÁ VENDENDO':'VOCÊ ESTÁ COMPRANDO'}</Text><Text style={s.orderTitle}>{order.productTitle}</Text></View><StatusPill value={order.status}/></View><Text style={s.orderPrice}>{price(order.amountCents)}</Text><Text style={s.orderCode}>{order.id} · {order.other?.name??'Contato indisponível'}</Text>{order.status==='requested'?<Text style={s.expiryText}>RESERVA AUTOMÁTICA POR ATÉ 24 HORAS</Text>:null}<View style={s.orderActions}>{order.other?.whatsapp?<Pressable onPress={()=>talk(order)} style={s.whatsapp}><Text style={s.whatsappText}>WHATSAPP</Text></Pressable>:null}{order.role==='seller'&&order.status==='requested'?<><Pressable onPress={()=>action(order,'accept')} style={s.accept}><Text style={s.acceptText}>ACEITAR</Text></Pressable><Pressable onPress={()=>action(order,'reject')} style={s.smallDanger}><Text style={s.dangerText}>RECUSAR</Text></Pressable></>:null}{order.role==='buyer'&&order.status==='requested'?<Pressable onPress={()=>action(order,'cancel')} style={s.smallDanger}><Text style={s.dangerText}>CANCELAR</Text></Pressable>:null}{order.status==='accepted'?<Pressable onPress={()=>action(order,'complete')} style={s.accept}><Text style={s.acceptText}>CONCLUIR</Text></Pressable>:null}</View></NeonCard>):<Empty>Nenhuma negociação encontrada.</Empty>}</View>;
}

export function Marketplace(){
  const [section,setSection]=useState<Section>('catalog'),[selected,setSelected]=useState<MarketplaceProduct|null>(null),[revision,setRevision]=useState(0);
  const changed=()=>{setRevision(value=>value+1);};
  if(selected)return <ProductDetails product={selected} onBack={()=>setSelected(null)} onChanged={()=>{changed();setSelected(null);setSection('orders');}}/>;
  return <View><View style={s.tabs}>{([['catalog','Comprar'],['sell','Vender'],['mine','Meus'],['orders','Negócios']] as [Section,string][]).map(item=><Pressable accessibilityRole="tab" accessibilityState={{selected:section===item[0]}} key={item[0]} onPress={()=>setSection(item[0])} style={[s.tab,section===item[0]&&s.tabOn]}><Text style={[s.tabText,section===item[0]&&s.tabTextOn]}>{item[1]}</Text></Pressable>)}</View>
    {section==='catalog'?<Catalog onSelect={setSelected}/>:section==='sell'?<SellerForm onCreated={()=>{changed();setSection('mine');}}/>:section==='mine'?<MyProducts refreshKey={revision} onSelect={setSelected}/>:<Orders refreshKey={revision}/>}</View>;
}

const s=StyleSheet.create({
  tabs:{flexDirection:'row',gap:5,backgroundColor:'rgba(4,15,20,.92)',borderWidth:1,borderColor:'#1d4150',borderRadius:14,padding:5,marginBottom:10},
  tab:{flex:1,minHeight:40,borderRadius:10,alignItems:'center',justifyContent:'center'},tabOn:{backgroundColor:'#70d8ff'},tabText:{color:'#75919c',fontSize:9,fontWeight:'900'},tabTextOn:{color:'#03131b'},
  section:{gap:10},sectionTitle:{color:'#fff',fontSize:24,fontWeight:'900'},sectionText:{color:'#9db2bc',fontSize:12,lineHeight:17},headingRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},refresh:{color:'#70d8ff',fontSize:8,fontWeight:'900',letterSpacing:.7,padding:12},
  searchRow:{flexDirection:'row',gap:7},search:{flex:1,height:48,borderWidth:1,borderColor:'#28576b',backgroundColor:'rgba(3,14,20,.94)',borderRadius:13,paddingHorizontal:13,color:'#fff',fontSize:13},searchButton:{width:48,height:48,borderRadius:13,backgroundColor:'#70d8ff',alignItems:'center',justifyContent:'center'},searchButtonText:{fontSize:23,color:'#03131b',fontWeight:'900'},
  chipRow:{gap:7,paddingVertical:2},chip:{borderWidth:1,borderColor:'#2a5364',borderRadius:18,paddingHorizontal:12,paddingVertical:8,backgroundColor:'rgba(4,18,25,.88)'},chipOn:{backgroundColor:'#70d8ff',borderColor:'#a8ecff'},chipText:{color:'#acc2cb',fontSize:10,fontWeight:'800'},chipTextOn:{color:'#03131b'},
  loader:{marginVertical:35},error:{color:'#ff8d86',fontSize:12,lineHeight:17},message:{color:'#d8f7ff',fontSize:12,lineHeight:18,backgroundColor:'rgba(10,41,52,.86)',padding:11,borderRadius:10},empty:{alignItems:'center',padding:30,borderRadius:16,borderWidth:1,borderColor:'#1e3943',backgroundColor:'rgba(3,14,19,.86)'},emptyIcon:{fontSize:30,color:'#547581'},emptyText:{color:'#8ca3ac',fontSize:12,textAlign:'center',marginTop:7},
  productCard:{minHeight:120,flexDirection:'row',padding:9,gap:12,backgroundColor:'rgba(5,19,25,.94)',borderWidth:1},productImage:{width:104,height:104,borderRadius:11,backgroundColor:'#071016'},noImage:{alignItems:'center',justifyContent:'center'},noImageText:{color:'#70d8ff',fontWeight:'900'},productBody:{flex:1,paddingVertical:3,justifyContent:'space-between'},productMetaRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},productCategory:{color:'#70d8ff',fontSize:8,fontWeight:'900',letterSpacing:1},mineTag:{color:'#ffd66b',fontSize:7,fontWeight:'900'},productTitle:{color:'#f4f9fa',fontSize:15,fontWeight:'800',lineHeight:19},productPrice:{color:'#70f0c2',fontSize:18,fontWeight:'900'},productMeta:{color:'#7f969f',fontSize:10},
  back:{minHeight:42,justifyContent:'center'},backText:{color:'#70d8ff',fontSize:9,fontWeight:'900',letterSpacing:.7},gallery:{height:285,borderRadius:17,backgroundColor:'#030b0f'},detailImage:{width:328,height:285},videoBox:{backgroundColor:'#030b0f',borderRadius:16,padding:8,borderWidth:1,borderColor:'#1c3d4b'},videoLabel:{color:'#688894',fontSize:7,fontWeight:'900',letterSpacing:.7,padding:6},detailVideo:{height:220,borderRadius:11},detailBody:{gap:10,padding:4},detailHeading:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},detailTitle:{color:'#fff',fontSize:23,fontWeight:'900',lineHeight:29},detailPrice:{color:'#70f0c2',fontSize:27,fontWeight:'900'},detailMeta:{color:'#9cb0b8',fontSize:12},rule:{height:1,backgroundColor:'#1a3843',marginVertical:3},detailLabel:{color:'#638795',fontSize:8,fontWeight:'900',letterSpacing:1.1},description:{color:'#d3dde1',fontSize:13,lineHeight:20},sellerBox:{borderWidth:1,borderColor:'#254957',borderRadius:13,padding:13,backgroundColor:'rgba(7,24,31,.88)'},sellerName:{color:'#fff',fontSize:15,fontWeight:'800',marginTop:4},privacy:{color:'#79939d',fontSize:10,marginTop:3},buyButton:{minHeight:54,borderRadius:13,backgroundColor:'#70f0c2',alignItems:'center',justifyContent:'center'},buyText:{color:'#03130d',fontSize:10,fontWeight:'900',letterSpacing:.5},reportButton:{minHeight:42,alignItems:'center',justifyContent:'center'},reportText:{color:'#a98181',fontSize:8,fontWeight:'900'},
  label:{color:'#70d8ff',fontSize:8,fontWeight:'900',letterSpacing:1.1,marginTop:4},input:{height:48,borderWidth:1,borderColor:'#28576b',backgroundColor:'rgba(3,14,20,.94)',borderRadius:12,paddingHorizontal:13,color:'#fff',fontSize:13},textarea:{height:118,paddingTop:13},optionRow:{flexDirection:'row',gap:6},option:{flex:1,minHeight:42,borderWidth:1,borderColor:'#2a5364',borderRadius:10,alignItems:'center',justifyContent:'center',paddingHorizontal:4},optionOn:{backgroundColor:'#70d8ff'},optionText:{color:'#9eb6c0',fontSize:8,fontWeight:'800',textAlign:'center'},optionTextOn:{color:'#03131b'},twoColumns:{flexDirection:'row',gap:8},column:{flex:1},ufColumn:{width:74},mediaRow:{gap:8},previewBox:{width:92,height:92},preview:{width:92,height:92,borderRadius:11},remove:{position:'absolute',right:4,top:4,width:25,height:25,borderRadius:13,backgroundColor:'rgba(20,5,5,.9)',alignItems:'center',justifyContent:'center'},removeText:{color:'#ffaca6',fontSize:18,lineHeight:20},addMedia:{width:92,height:92,borderWidth:1,borderStyle:'dashed',borderColor:'#397185',borderRadius:11,alignItems:'center',justifyContent:'center'},addMediaIcon:{color:'#70d8ff',fontSize:25},addMediaText:{color:'#70d8ff',fontSize:7,fontWeight:'900'},videoPicker:{height:48,borderWidth:1,borderStyle:'dashed',borderColor:'#397185',borderRadius:12,alignItems:'center',justifyContent:'center'},videoPickerText:{color:'#70d8ff',fontSize:9,fontWeight:'900'},videoSelected:{minHeight:50,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderWidth:1,borderColor:'#2d6656',backgroundColor:'rgba(7,39,29,.86)',borderRadius:12,paddingHorizontal:12},videoSelectedText:{color:'#d9fff1',fontSize:11,flex:1},removeVideo:{color:'#ff9d96',fontSize:8,fontWeight:'900'},termsRow:{flexDirection:'row',alignItems:'flex-start',gap:9,paddingVertical:4},checkbox:{width:22,height:22,borderWidth:1,borderColor:'#3c6b7b',borderRadius:6,alignItems:'center',justifyContent:'center'},checkboxOn:{backgroundColor:'#70f0c2',borderColor:'#70f0c2'},check:{color:'#04130d',fontWeight:'900'},termsText:{flex:1,color:'#91a8b0',fontSize:10,lineHeight:15},publish:{height:54,borderRadius:13,backgroundColor:'#70f0c2',alignItems:'center',justifyContent:'center'},publishText:{color:'#04130d',fontSize:11,fontWeight:'900',letterSpacing:.6},disabledButton:{opacity:.65},
  actions:{flexDirection:'row',alignItems:'center',justifyContent:'flex-end',gap:7,marginTop:-3,marginBottom:8,paddingHorizontal:5},statusPill:{paddingHorizontal:8,paddingVertical:5,borderRadius:9,borderWidth:1},statusGood:{backgroundColor:'#113c2c',borderColor:'#2c8b69'},statusWarn:{backgroundColor:'#493d14',borderColor:'#92792b'},statusMuted:{backgroundColor:'#252c30',borderColor:'#4a575c'},statusText:{color:'#e7f8f2',fontSize:7,fontWeight:'900',letterSpacing:.5},secondaryButton:{minHeight:32,borderWidth:1,borderColor:'#41606b',borderRadius:9,paddingHorizontal:11,alignItems:'center',justifyContent:'center'},secondaryText:{color:'#b9d3dc',fontSize:8,fontWeight:'900'},dangerText:{color:'#ff9d96',fontSize:8,fontWeight:'900'},
  orderCard:{padding:14,gap:7,backgroundColor:'rgba(20,14,38,.93)',borderWidth:1},orderHeading:{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:8},orderTitleBox:{flex:1},orderRole:{color:'#b29aff',fontSize:7,fontWeight:'900',letterSpacing:.8},orderTitle:{color:'#fff',fontSize:15,fontWeight:'900',marginTop:3},orderPrice:{color:'#70f0c2',fontSize:18,fontWeight:'900'},orderCode:{color:'#84939c',fontSize:9},expiryText:{color:'#ffd66b',fontSize:7,fontWeight:'900',letterSpacing:.5},orderActions:{flexDirection:'row',gap:6,marginTop:5},whatsapp:{minHeight:36,borderRadius:9,backgroundColor:'#35db83',paddingHorizontal:12,alignItems:'center',justifyContent:'center'},whatsappText:{color:'#03130d',fontSize:8,fontWeight:'900'},accept:{minHeight:36,borderRadius:9,backgroundColor:'#b29aff',paddingHorizontal:12,alignItems:'center',justifyContent:'center'},acceptText:{color:'#120924',fontSize:8,fontWeight:'900'},smallDanger:{minHeight:36,borderRadius:9,borderWidth:1,borderColor:'#74413f',paddingHorizontal:11,alignItems:'center',justifyContent:'center'},
});
