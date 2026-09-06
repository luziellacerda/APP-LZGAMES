(function ($) {
  'use strict';
  let quote = null, pending = false, generation = 0;
  const money = cents => (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const fields = '#frete,#mao_obra,#desconto,#val_entrada,#vall';
  const currentId = () => String($('#id').val() || '');
  function message(value) { $('#app-credit-message').text(value); }
  function lockFields(locked) {
    $(fields).prop('readOnly', locked);
    $('#tipo_desconto').prop('disabled', locked);
  }
  function buttons() {
    $('#app-credit-refresh').prop('disabled', pending);
    $('#app-credit-apply').prop('disabled', pending || !quote || !!quote.active || quote.limit_cents < 1);
    $('#app-credit-undo').prop('disabled', pending || !quote?.active?.can_undo);
  }
  function reset() {
    generation++; quote = null; pending = false; lockFields(false);
    $('#app-credit-balance').text('');$('#app-credit-amount,#app-credit-reason').val('');
    $('#app-credit-reason,#app-credit-undo').prop('hidden',true);
    $('#app-credit-amount,#app-credit-apply,label[for="app-credit-amount"]').prop('hidden',false);
    message('Salve a OS antes de consultar. O crédito é exclusivo para serviços, sem saque.');buttons();
  }
  async function request(action, values) {
    return $.ajax({url:'paginas/os/app_credit.php',method:'POST',dataType:'json',timeout:12000,
      data:{action,csrf:$('#app-credit-csrf').val(),...values}});
  }
  async function refresh() {
    const id = currentId();
    if (!/^[1-9][0-9]*$/.test(id)) { reset(); return; }
    if (pending) return;
    const seq = ++generation;
    pending = true; buttons(); message('Conferindo o saldo e os serviços da nota salva…');
    try {
      const result = await request('quote', {id});
      if (seq !== generation || id !== currentId()) return;
      quote = result.data;
      $('#subtotal').val((quote.subtotal_cents/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}));
      $('#app-credit-balance').text('Disponível: ' + money(quote.available_cents) + ' · Usado: ' + money(quote.used_cents));
      $('#app-credit-amount').val((quote.limit_cents/100).toFixed(2).replace('.',','));
      $('#app-credit-reason,#app-credit-undo').prop('hidden', !quote.active?.can_undo);
      $('#app-credit-amount,#app-credit-apply,label[for="app-credit-amount"]').prop('hidden', !!quote.active);
      lockFields(!!quote.active);
      if (quote.active) {
        $('#subtotal').val((quote.subtotal_cents/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}));
        message('Aplicado nesta OS: ' + money(quote.active.amount_cents) + '. Valores e itens protegidos. ' + (quote.reason || 'Para alterar valores, primeiro estorne o crédito. Dados técnicos e pagamento continuam disponíveis.'));
      } else message(quote.reason || 'Limite nesta nota: ' + money(quote.limit_cents) + '. Salve alterações de itens/valores antes de aplicar.');
    } catch (error) {
      if (seq !== generation) return;
      quote = null; message(error.responseJSON?.message || 'Não foi possível consultar. Atualize antes de tentar aplicar.');
    } finally { if (seq === generation) { pending = false; buttons(); } }
  }
  async function mutate(action) {
    if (pending || !quote || String(quote.os_id) !== currentId()) return;
    let values={id:quote.os_id,customer_id:quote.customer_id};
    if (action === 'apply') {
      if (String($('#cliente').val() || '') !== String(quote.customer_id)) {message('O cliente selecionado mudou. Salve a OS antes de aplicar créditos.');return;}
      const raw=String($('#app-credit-amount').val()||'').trim();
      if (!/^[0-9]{1,6}(?:[,.][0-9]{1,2})?$/.test(raw)) {message('Informe um valor como 9,90.');return;}
      const parts=raw.replace(',','.').split('.');const cents=Number(parts[0])*100+Number((parts[1]||'').padEnd(2,'0'));
      if (cents<1 || cents>quote.limit_cents) {message('Valor acima do limite disponível para esta nota.');return;}
      values={...values,amount_cents:cents,subtotal_cents:quote.subtotal_cents,request_id:quote.request_id};
    } else {
      const reason=String($('#app-credit-reason').val()||'').trim();
      if (!quote.active?.can_undo || reason.length<5) {message('Informe o motivo do estorno, com pelo menos 5 caracteres.');return;}
      values={...values,request_id:quote.active.id,reason};
    }
    const seq=generation;pending=true;buttons();
    try {
      await request(action,values);
      if(seq!==generation)return;
      pending=false;await refresh();
      // Refresh the list only; never auto-save the form or send a WhatsApp message.
      if (typeof window.buscar==='function') window.buscar();
    } catch(error) {
      if(seq===generation)message(error.responseJSON?.message || 'Confirmação indisponível. Consulte a nota antes de repetir.');
    } finally {if(seq===generation){pending=false;buttons();}}
  }
  let openScheduled=false;
  function opened() {
    // Bootstrap 5 dispatches native events too. Coalesce the jQuery/native notifications.
    if(openScheduled)return;openScheduled=true;
    queueMicrotask(()=>{openScheduled=false;reset();refresh();});
  }
  if(window.lzAppCreditNativeCleanup)window.lzAppCreditNativeCleanup();
  const onShown=e=>{if(e.target.id==='modalForm')opened();};
  const onHidden=e=>{if(e.target.id==='modalForm')reset();};
  document.addEventListener('shown.bs.modal',onShown);
  document.addEventListener('hidden.bs.modal',onHidden);
  window.lzAppCreditNativeCleanup=()=>{document.removeEventListener('shown.bs.modal',onShown);document.removeEventListener('hidden.bs.modal',onHidden);};
  $(document).off('.lzAppCredit');
  $(document).on('click.lzAppCredit','#app-credit-refresh',refresh);
  $(document).on('click.lzAppCredit','#app-credit-apply',()=>mutate('apply'));
  $(document).on('click.lzAppCredit','#app-credit-undo',()=>mutate('undo'));
  $(document).on('shown.bs.modal.lzAppCredit','#modalForm',opened);
  $(document).on('hidden.bs.modal.lzAppCredit','#modalForm',reset);
})(jQuery);
