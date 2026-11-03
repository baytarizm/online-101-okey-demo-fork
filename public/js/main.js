'use strict';
const socket = io({transports:['websocket']});
const $ = id => document.getElementById(id);
let create = true;
const inviteCode = new URLSearchParams(location.search).get('room');
function mode(value) {
  create = value;
  $('createTab').classList.toggle('active',value); $('joinTab').classList.toggle('active',!value);
  $('codeField').hidden = value; $('options').hidden = !value;
  $('roomCode').required = !value;
  $('playBots').hidden = !value;
  $('playBots').disabled = !value || !socket.connected;
  $('enterButton').classList.toggle('primary',!value);
  $('enterButton').classList.toggle('subtle',value);
  $('enterButton').textContent = value ? 'Arkadaş masası kur →' : 'Masaya katıl →';
}
$('createTab').onclick = () => mode(true); $('joinTab').onclick = () => mode(false);
if (inviteCode) { mode(false); $('roomCode').value = inviteCode.toUpperCase(); }
try { $('playerName').value = localStorage.getItem('haysagOkeyName') || ''; } catch {}
socket.on('connect', () => { $('enterButton').disabled = false; mode(create); $('message').textContent = ''; });
socket.on('connect_error', () => { $('message').textContent = 'Bağlantı kurulamadı. Otomatik yeniden deneniyor…'; $('enterButton').disabled = true; $('playBots').disabled = true; });
socket.on('disconnect', () => { $('enterButton').disabled = true; $('playBots').disabled = true; $('message').textContent = 'Bağlantı yenileniyor…'; });
const settingLabels={ACMA_BARAJI_SERI:'Seri açılış puanı',ACMA_BARAJI_CIFT:'Çift sayısı',TUR_SURESI_SN:'Tur süresi (sn, 0 = süresiz)',ISLEME_ACIK:'Taş işleme',ORTAK_ISLEME:'Eşin perlerine işleme',OKEY_YERDEN_ALINABILIR:'Yerden okey alma',OKEY_ATMA_YASAK:'Okey atma yasağı',SERI_DONUSU:'13 → 1 serisine izin ver',SAHTE_OKEY_MODU:'Sahte okeyin anlamı',JOKER_AYNI_TUR_KULLAN:'Alınan joker aynı turda kullanılmalı',BITIS_ISLEYEREK:'Son taşı işleyerek bitirme',ESIN_ELI_KAPANIR:'Kazananın eşine ceza yazma',ACMAMIS_CEZA:'Açmamış oyuncu cezası',NORMAL_CARPAN:'Normal bitiş çarpanı',OKEY_CARPAN:'Okeyle bitiş çarpanı',CIFT_CARPAN:'Çift bitiş çarpanı',ELDEN_CARPAN:'Elden bitiş çarpanı',KAZANAN_PUAN:'Kazanan puanı',ELDE_OKEY_CEZA:'Elde kalan okey cezası',ISLER_TAS_CEZA:'İşler taş atma cezası',RENK_SIMGE:'Taşlarda renk simgesi',OKEY_PARLAT:'Eldeki okeyi vurgula',CEKME_MS:'Taş çekme animasyonu (ms)',ATMA_MS:'Taş atma animasyonu (ms)',ACMA_MS:'Açılış animasyonu (ms)'};
for(const [key,label] of Object.entries(settingLabels)){
 const row=document.createElement('label');row.className='setting-row';row.textContent=label;
 const def=GameRules.DEFAULTS[key],input=document.createElement(key==='SAHTE_OKEY_MODU'?'select':'input');input.dataset.setting=key;
 if(key==='SAHTE_OKEY_MODU')for(const [v,label] of [['GOSTERGE','Göstergeyi temsil eder'],['OKEY','Okey değerinin sabit taşı'],['JOKER','Serbest joker']]){const o=document.createElement('option');o.value=v;o.textContent=label;input.append(o);}
 else if(typeof def==='boolean'){input.type='checkbox';input.checked=def;}
 else {input.type='number';input.min=key==='KAZANAN_PUAN'?-10000:0;input.max=key==='TUR_SURESI_SN'?600:10000;input.value=def;input.required=true;}
 row.append(input);$('ruleSettings').append(row);
}
function tableConfig(){const input={};document.querySelectorAll('[data-setting]').forEach(e=>input[e.dataset.setting]=e.type==='checkbox'?e.checked:e.type==='number'?Number(e.value):e.value);return GameRules.config(input);}
$('entryForm').onsubmit = event => {
  event.preventDefault(); $('enterButton').disabled = true; $('playBots').disabled = true; $('message').textContent = 'Masaya katılınıyor…';
  let chosenConfig;try{chosenConfig=tableConfig();}catch(error){$('message').textContent=error.message;$('enterButton').disabled=false;$('playBots').disabled=!create;return;}
  socket.emit('joinGame',{create, playerName:$('playerName').value.trim(), roomCode:$('roomCode').value.trim().toUpperCase(),
    config:chosenConfig,withBots:create && event.submitter?.id==='playBots', teamMode:$('teamMode').checked, stackingMode:$('stackingMode').checked, penaltyMode:$('penaltyMode').checked});
};
socket.on('session', session => {
  try { sessionStorage.setItem('haysagOkeySession',JSON.stringify(session)); localStorage.setItem('haysagOkeyName',session.playerName); }
  catch { $('message').textContent = 'Oyuna katılmak için bu sitede oturum depolamasına izin verin.'; socket.disconnect(); return; }
  location.href = '/game?room=' + session.roomCode;
});
socket.on('gameError', data => { $('message').textContent = data.message; $('enterButton').disabled = !socket.connected; $('playBots').disabled = !socket.connected || !create; });
