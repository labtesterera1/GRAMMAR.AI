/* ════════════════════════════════════════════════════════════════
   GUTS · Get Up To Speed · controller.js · v1.1.0
   Grammar.AI module — MOD 09
   Fixes v1.1: renderWordBank rename, auto-hindi, story mode, staging
   ════════════════════════════════════════════════════════════════ */

import { $, esc, toast, downloadFile, pickFile } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';
import { AI } from '../../core/ai.js';

const MODULE_VERSION = '1.1.0';
const SCOPE = Storage.scope('guts');

/* ── AI Prompts ─────────────────────────────────────────────── */
const P_STORY = `You are a Deep English language teacher inspired by Deep English (Aaron Campbell).
Transform the given content into a rich story-style English learning lesson.
Guidelines:
- Write 4-6 natural paragraphs, each 3-5 sentences
- Use engaging narrative voice — learner feels they are reading a story, not an article
- Preserve ALL key information and facts from the original content
- Mix short punchy sentences with longer flowing ones for rhythm
- Use rich vocabulary naturally in context — do not simplify excessively
- Build from simpler ideas to complex ones across paragraphs
- Write for intermediate English learners (Indian audience)
- Do NOT add labels like "Paragraph 1:" — pure story text only
Return ONLY the story text. Nothing else.`;

const P_VOCAB_BATCH = `You are a Hindi-English vocabulary expert for Indian learners.
Given a comma-separated list of English words, return ONLY valid JSON:
{"word1":"हिंदी अर्थ","word2":"हिंदी अर्थ"}
Rules: each Hindi meaning is 1-4 words, most natural translation.
If no good Hindi equivalent, write the English word phonetically in Devanagari.
Return ONLY the JSON object. No markdown. No explanation.`;

const P_WORD = `You are an English vocabulary expert for Indian learners. For the word given return ONLY valid JSON (no markdown):
{"synonyms":["word1","word2","word3"],"sentences":["Sentence using word1.","Sentence using word2."],"devanagari":["देवनागरी1","देवनागरी2","देवनागरी3"]}
devanagari = phonetic Devanagari of each English synonym. Return ONLY the JSON object.`;

const P_PDF = `You are a text reconstruction expert. This text was extracted from a PDF and may have column artifacts, broken lines, page numbers, headers, footers. Reconstruct it as clean readable prose exactly as the original author intended. Return ONLY the clean text.`;

const P_QUIZ = `You are an English comprehension teacher for Indian learners. Generate 3 multiple-choice questions from the given text. Return ONLY valid JSON array (no markdown):
[{"q":"Question?","options":["a","b","c","d"],"answer":"a","explain":"Brief reason."}]`;

/* ── Module-level data ────────────────────────────────────────── */
const HD = {
  fluency:'प्रवाह',fluent:'धाराप्रवाह',vocabulary:'शब्द भंडार',grammar:'व्याकरण',
  pronunciation:'उच्चारण',communicate:'संवाद करना',conversation:'बातचीत',
  expression:'अभिव्यक्ति',language:'भाषा',understand:'समझना',practice:'अभ्यास',
  improve:'सुधारना',learning:'सीखना',knowledge:'ज्ञान',lesson:'पाठ',
  sentence:'वाक्य',meaning:'अर्थ',translate:'अनुवाद करना',comprehend:'समझना',
  articulate:'स्पष्ट बोलना',eloquent:'वाक्पटु',bilingual:'द्विभाषी',
  interpret:'व्याख्या करना',narrate:'वर्णन करना',describe:'वर्णन करना',
  explain:'समझाना',define:'परिभाषित करना',clarify:'स्पष्ट करना',
  emphasize:'जोर देना',summarize:'सारांश देना',elaborate:'विस्तार करना',
  illustrate:'चित्रित करना',simplify:'सरल करना',paraphrase:'दूसरे शब्दों में',
  transcript:'लिखित प्रति',confidence:'आत्मविश्वास',motivation:'प्रेरणा',
  resilience:'लचीलापन',perspective:'दृष्टिकोण',imagination:'कल्पना',
  creativity:'रचनात्मकता',awareness:'जागरूकता',mindset:'मानसिकता',
  potential:'क्षमता',discipline:'अनुशासन',patience:'धैर्य',
  commitment:'प्रतिबद्धता',consistent:'लगातार',progress:'प्रगति',
  achievement:'उपलब्धि',success:'सफलता',failure:'विफलता',challenge:'चुनौती',
  opportunity:'अवसर',experience:'अनुभव',wisdom:'बुद्धिमानी',intelligence:'बुद्धि',
  intuition:'अंतर्ज्ञान',perception:'अनुभूति',curiosity:'जिज्ञासा',
  determination:'दृढ़ संकल्प',perseverance:'दृढ़ता',ambition:'महत्वाकांक्षा',
  aspiration:'आकांक्षा',inspiration:'प्रेरणा',transformation:'परिवर्तन',
  evolution:'विकास',adaptation:'अनुकूलन',innovation:'नवाचार',
  breakthrough:'सफलता',overcome:'पार करना',accomplish:'प्राप्त करना',
  strive:'प्रयास करना',pursue:'अनुसरण करना',dedicate:'समर्पित करना',
  focus:'ध्यान केंद्रित',concentrate:'केंद्रित करना',reflect:'विचार करना',
  contemplate:'चिंतन करना',analyze:'विश्लेषण करना',evaluate:'मूल्यांकन करना',
  prioritize:'प्राथमिकता देना',organize:'व्यवस्थित करना',
  philosophy:'दर्शनशास्त्र',psychology:'मनोविज्ञान',spirituality:'आध्यात्मिकता',
  principle:'सिद्धांत',strategy:'रणनीति',process:'प्रक्रिया',effective:'प्रभावी',
  efficient:'कुशल',essential:'आवश्यक',important:'महत्वपूर्ण',valuable:'मूल्यवान',
  meaningful:'सार्थक',significant:'महत्वपूर्ण',fundamental:'मूलभूत',
  determine:'निर्धारित करना',establish:'स्थापित करना',demonstrate:'प्रदर्शित करना',
  recognize:'पहचानना',appreciate:'सराहना करना',theory:'सिद्धांत',concept:'अवधारणा',
  hypothesis:'परिकल्पना',argument:'तर्क',evidence:'प्रमाण',analysis:'विश्लेषण',
  interpretation:'व्याख्या',conclusion:'निष्कर्ष',assumption:'धारणा',
  consequence:'परिणाम',pattern:'पैटर्न',structure:'संरचना',framework:'ढांचा',
  mechanism:'तंत्र',phenomenon:'घटना',paradigm:'प्रतिमान',complexity:'जटिलता',
  diversity:'विविधता',inclusion:'समावेश',sustainability:'स्थिरता',integrity:'ईमानदारी',
  happiness:'खुशी',sadness:'दुख',excitement:'उत्साह',enthusiasm:'उत्साह',
  passion:'जुनून',compassion:'करुणा',empathy:'सहानुभूति',sympathy:'सहानुभूति',
  gratitude:'कृतज्ञता',forgiveness:'क्षमा',hope:'आशा',loneliness:'अकेलापन',
  contentment:'संतोष',frustration:'निराशा',disappointment:'निराशा',
  satisfaction:'संतुष्टि',pride:'गर्व',shame:'शर्म',guilt:'दोष',jealousy:'ईर्ष्या',
  admiration:'प्रशंसा',respect:'सम्मान',trust:'विश्वास',doubt:'संदेह',
  confusion:'भ्रम',surprise:'आश्चर्य',wonder:'आश्चर्य',nostalgia:'पुरानी यादें',
  melancholy:'उदासी',serenity:'शांति',tranquility:'शांति',overwhelmed:'अभिभूत',
  motivated:'प्रेरित',curious:'जिज्ञासु',nervous:'घबराया',grateful:'कृतज्ञ',
  anxious:'चिंतित',joyful:'आनंदित',peaceful:'शांतिपूर्ण',restless:'बेचैन',
  achieve:'प्राप्त करना',believe:'विश्वास करना',consider:'विचार करना',
  develop:'विकसित करना',encourage:'प्रोत्साहित करना',facilitate:'सुगम करना',
  generate:'उत्पन्न करना',implement:'लागू करना',investigate:'जांच करना',
  justify:'उचित ठहराना',maintain:'बनाए रखना',negotiate:'बातचीत करना',
  observe:'देखना',participate:'भाग लेना',respond:'जवाब देना',support:'समर्थन करना',
  utilize:'उपयोग करना',validate:'मान्य करना',acquire:'प्राप्त करना',
  collaborate:'सहयोग करना',contribute:'योगदान देना',coordinate:'समन्वय करना',
  create:'बनाना',debate:'बहस करना',examine:'जांच करना',explore:'खोज करना',
  identify:'पहचानना',integrate:'एकीकृत करना',manage:'प्रबंधन करना',
  monitor:'निगरानी करना',motivate:'प्रेरित करना',perform:'प्रदर्शन करना',
  promote:'बढ़ावा देना',publish:'प्रकाशित करना',suggest:'सुझाना',
  teach:'सिखाना',transform:'बदलना',verify:'सत्यापित करना',
  accurate:'सटीक',authentic:'प्रामाणिक',brilliant:'शानदार',capable:'सक्षम',
  decisive:'निर्णायक',dedicated:'समर्पित',flexible:'लचीला',focused:'केंद्रित',
  generous:'उदार',genuine:'वास्तविक',graceful:'कृपाशील',humble:'विनम्र',
  innovative:'अभिनव',insightful:'अंतर्दृष्टिपूर्ण',intentional:'जानबूझकर',
  logical:'तार्किक',methodical:'व्यवस्थित',objective:'वस्तुनिष्ठ',
  optimistic:'आशावादी',organized:'व्यवस्थित',persistent:'दृढ़',
  practical:'व्यावहारिक',proactive:'सक्रिय',productive:'उत्पादक',
  professional:'पेशेवर',reliable:'विश्वसनीय',resourceful:'साधन-संपन्न',
  responsible:'जिम्मेदार',sensitive:'संवेदनशील',sincere:'ईमानदार',skilled:'कुशल',
  strategic:'रणनीतिक',structured:'संरचित',systematic:'व्यवस्थित',
  thoughtful:'विचारशील',thorough:'संपूर्ण',versatile:'बहुमुखी',vibrant:'जीवंत',
  visionary:'दूरदर्शी',adaptive:'अनुकूलनीय',analytical:'विश्लेषणात्मक',
  collaborative:'सहयोगी',comprehensive:'व्यापक',constructive:'रचनात्मक',
  dynamic:'गतिशील',ethical:'नैतिक',moment:'पल',duration:'अवधि',
  century:'सदी',sequence:'क्रम',frequency:'आवृत्ति',interval:'अंतराल',
  distance:'दूरी',location:'स्थान',position:'स्थिति',direction:'दिशा',
  boundary:'सीमा',horizon:'क्षितिज',landscape:'परिदृश्य',territory:'क्षेत्र',
  atmosphere:'वातावरण',circumstance:'परिस्थिति',situation:'स्थिति',
  background:'पृष्ठभूमि',foundation:'नींव',origin:'उत्पत्ति',destination:'मंजिल',
  momentum:'गति',trajectory:'प्रक्षेपवक्र',ecosystem:'पारिस्थितिकी',
  biodiversity:'जैव विविधता',conservation:'संरक्षण',climate:'जलवायु',
  geography:'भूगोल',wilderness:'जंगल',vegetation:'वनस्पति',mountain:'पर्वत',
  river:'नदी',ocean:'महासागर',forest:'वन',season:'मौसम',rainfall:'वर्षा',
  temperature:'तापमान',organic:'जैविक',renewable:'नवीकरणीय',
  profession:'पेशा',career:'करियर',industry:'उद्योग',organization:'संगठन',
  management:'प्रबंधन',leadership:'नेतृत्व',productivity:'उत्पादकता',
  efficiency:'दक्षता',revenue:'राजस्व',investment:'निवेश',
  entrepreneurship:'उद्यमिता',infrastructure:'बुनियादी ढांचा',
  technology:'प्रौद्योगिकी',marketing:'विपणन',partnership:'साझेदारी',
  stakeholder:'हितधारक',deadline:'समय सीमा',milestone:'मील का पत्थर',
  feedback:'प्रतिक्रिया',performance:'प्रदर्शन',accountability:'जवाबदेही',
  transparency:'पारदर्शिता',governance:'शासन',compliance:'अनुपालन',
  implementation:'कार्यान्वयन',recommendation:'सिफारिश',
  wellness:'स्वास्थ्य',nutrition:'पोषण',meditation:'ध्यान',mindfulness:'सजगता',
  therapy:'चिकित्सा',diagnosis:'निदान',treatment:'उपचार',prevention:'रोकथाम',
  recovery:'स्वास्थ्य लाभ',immunity:'प्रतिरक्षा',metabolism:'चयापचय',
  consciousness:'चेतना',relaxation:'विश्राम',vitality:'जीवन शक्ति',
  stamina:'सहनशक्ति',endurance:'धीरज',strength:'शक्ति',balance:'संतुलन',
  coordination:'समन्वय',breathing:'श्वास',rehabilitation:'पुनर्वास',
  healing:'उपचार',longevity:'दीर्घायु',lifestyle:'जीवन शैली',
  relationship:'संबंध',friendship:'मित्रता',community:'समुदाय',
  society:'समाज',culture:'संस्कृति',tradition:'परंपरा',heritage:'विरासत',
  equality:'समानता',justice:'न्याय',democracy:'लोकतंत्र',freedom:'स्वतंत्रता',
  responsibility:'जिम्मेदारी',mentorship:'मार्गदर्शन',cooperation:'सहयोग',
  tolerance:'सहिष्णुता',celebration:'उत्सव',recognition:'पहचान',
  encouragement:'प्रोत्साहन',guidance:'मार्गदर्शन',empowering:'सशक्त बनाना',
  /* common general words */
  platform:'मंच',strategy:'रणनीति',director:'निर्देशक',industry:'उद्योग',
  release:'रिलीज़',streaming:'स्ट्रीमिंग',content:'सामग्री',digital:'डिजिटल',
  global:'वैश्विक',market:'बाज़ार',company:'कंपनी',business:'व्यवसाय',
  production:'निर्माण',distribution:'वितरण',audience:'दर्शक',commercial:'व्यावसायिक',
  exclusive:'विशेष',original:'मूल',according:'अनुसार',upcoming:'आगामी',
  expected:'अपेक्षित',reported:'रिपोर्ट किया',announced:'घोषित',confirmed:'पुष्टि',
  signals:'संकेत',uncommon:'असामान्य',footprint:'उपस्थिति',blockbuster:'ब्लॉकबस्टर',
  reported:'रिपोर्टेड',filmmaker:'फिल्मनिर्माता',international:'अंतर्राष्ट्रीय',
  domestic:'घरेलू',theatrical:'थियेट्रिकल',franchise:'फ्रेंचाइज़',
};

const CW = new Set(['the','be','to','of','and','a','in','that','have','it','for','not','on','with','he','as','you','do','at','this','but','his','by','from','they','we','say','her','she','or','an','will','my','one','all','would','there','their','what','so','up','out','if','about','who','get','which','go','me','when','make','can','like','time','no','just','him','know','take','people','into','year','your','good','some','could','them','see','other','than','then','now','look','only','come','its','over','think','also','back','after','use','two','how','our','work','first','well','way','even','new','want','because','any','these','give','day','most','need','often','hand','high','place','hold','turn','help','start','never','next','hard','open','seem','always','both','show','feel','long','those','old','face','tell','keep','every','find','much','still','though','should','where','does','around','three','small','set','put','end','another','right','big','too','many','before','must','through','under','little','being','while','become','already','against','without','same','different','however','between','might','going','great','here','were','been','used','said','each','more','very','made','such','once','away','down','film','will','also','has','was','are','have','its','their','been','has','had','film','films','will','said','that','this','with','from','have','they','which','were','when','than']);

const CP = ['get up to speed','bear in mind','keep in mind','on the other hand','in other words','as a result','for example','for instance','in addition','at the same time','in fact','as well as','more than ever','look forward to','take for granted','point of view','make a difference','come up with','put up with','at least','in order to','as long as','even though','in spite of','due to','according to','in terms of','take part in','make sure','find out','figure out','right away','after all','all of a sudden','once in a while','sooner or later','on the whole','as far as','in general','at first','to begin with','on top of that','as a matter of fact','in the long run','at the end of the day','when it comes to','in my opinion','based on','in contrast','get rid of','keep in touch','run out of','look up to','carry on','catch up','give up','move on','stand out','work out'];

/* ── Helpers ──────────────────────────────────────────────────── */
function gFmt(ts){return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'2-digit'}).format(new Date(ts));}
function gId(){return 'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function gJSON(t){try{return JSON.parse(t.replace(/```json|```/g,'').trim());}catch{return null;}}
function sCls(s){return s==='done'?'s-done':s==='reading'?'s-reading':'s-unread';}
function sLbl(s){return s==='done'?'✓ Done':s==='reading'?'▶ Reading':'○ Unread';}
function wordCount(t){return(t.match(/\b\w+\b/g)||[]).length;}
/* Auto-hindi lookup: HD first, then cached AI translation */
function getHindi(word){return HD[word]||SCOPE.get('ah.'+word,null)||'';}

async function sha256(text){const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');}

/* ── Speech ───────────────────────────────────────────────────── */
let _spk=false,_pau=false,_rate=1.0,_sents=[],_idx=0,_spkCb=null;
function speakText(text,rate,onSentence){
  if(!('speechSynthesis' in window)){toast('Speech not supported');return;}
  stopSpeech();
  const ss=tokenizeSentences(stripHTML(text));
  if(!ss.length)return;
  _sents=ss;_idx=0;_spk=true;_pau=false;_rate=rate||1;_spkCb=onSentence||null;_next();
}
function _next(){
  if(!_spk||_idx>=_sents.length){_spk=false;if(_spkCb)_spkCb(-1);_raSync();return;}
  if(_spkCb)_spkCb(_idx);
  const u=new SpeechSynthesisUtterance(_sents[_idx]);u.rate=_rate;u.lang='en-US';
  u.onend=()=>{_idx++;_next();};u.onerror=()=>{_idx++;_next();};
  window.speechSynthesis.speak(u);_raSync();
}
function stopSpeech(){_spk=false;_pau=false;if('speechSynthesis' in window)window.speechSynthesis.cancel();if(_spkCb){_spkCb(-1);_spkCb=null;}_raSync();}
function _raSync(){const pl=document.getElementById('g-ra-play'),pa=document.getElementById('g-ra-pause'),st=document.getElementById('g-ra-stop');if(!pl)return;pl.disabled=_spk&&!_pau;pa.disabled=!_spk||_pau;st.disabled=!_spk;pl.textContent=_pau?'▶ Resume':'▶';}
function stripHTML(h){const d=document.createElement('div');d.innerHTML=h;return d.innerText||d.textContent||'';}

/* ── File readers ─────────────────────────────────────────────── */
async function readFile(file){
  const n=file.name.toLowerCase();
  if(n.endsWith('.pdf'))return readPdf(file);
  if(n.endsWith('.docx'))return readDocx(file);
  if(n.endsWith('.pptx'))return readPptx(file);
  if(n.endsWith('.vtt'))return readVtt(await file.text());
  if(n.endsWith('.srt'))return readSrt(await file.text());
  try{return await file.text();}catch{throw new Error('Cannot read '+file.name+' as text');}
}
async function readPdf(file){
  const lib=window.pdfjsLib;if(!lib)throw new Error('PDF.js not loaded — reload the app');
  lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const buf=await file.arrayBuffer(),pdf=await lib.getDocument({data:buf}).promise;
  const pages=[];
  for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();const items=content.items.filter(it=>it.str.trim());if(!items.length)continue;const xs=items.map(it=>it.transform[4]),mid=(Math.min(...xs)+Math.max(...xs))/2;const left=items.filter(it=>it.transform[4]<mid).map(it=>it.str).join(' '),right=items.filter(it=>it.transform[4]>=mid).map(it=>it.str).join(' ');pages.push((left.length>50&&right.length>50)?left+'\n\n'+right:items.map(it=>it.str).join(' '));}
  return pages.join('\n\n').trim();
}
async function readDocx(file){const Z=window.JSZip;if(!Z)throw new Error('JSZip not loaded');const zip=await Z.loadAsync(file),xml=await zip.file('word/document.xml').async('text');return xml.replace(/<w:br[^>]*>/gi,'\n').replace(/<\/w:p>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\n{3,}/g,'\n\n').trim();}
async function readPptx(file){const Z=window.JSZip;if(!Z)throw new Error('JSZip not loaded');const zip=await Z.loadAsync(file),slides=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort();let text='';for(const s of slides){const xml=await zip.files[s].async('text');const t=xml.replace(/<a:t>/g,' ').replace(/<a:p[^>]*>/g,'\n').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();if(t)text+=t+'\n\n';}return text.trim();}
function readVtt(raw){return raw.split('\n').filter(l=>!l.match(/^WEBVTT|^\d+$|-->/)).join(' ').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();}
function readSrt(raw){return raw.replace(/^\d+\s*$/gm,'').replace(/\d{2}:\d{2}:\d{2},\d+\s*-->\s*\d{2}:\d{2}:\d{2},\d+/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();}

/* ── AI features ──────────────────────────────────────────────── */
async function aiStoryMode(text){
  if(!AI.hasAnyRoute())return text;
  try{
    /* chunk large texts to stay under token limits */
    if(wordCount(text)>800){
      const paras=text.split(/\n\n+/).filter(p=>p.trim().length>20);
      const half=Math.ceil(paras.length/2);
      const [p1,p2]=await Promise.all([
        AI.chat([{role:'system',content:P_STORY},{role:'user',content:paras.slice(0,half).join('\n\n')}],{maxTokens:900}),
        AI.chat([{role:'system',content:P_STORY},{role:'user',content:paras.slice(half).join('\n\n')}],{maxTokens:900}),
      ]);
      return p1.text+'\n\n'+p2.text;
    }
    const{text:t}=await AI.chat([{role:'system',content:P_STORY},{role:'user',content:text}],{maxTokens:1200});
    return t||text;
  }catch{return text;}
}

async function aiCleanPdf(text){
  if(!AI.hasAnyRoute())return text;
  const lines=text.split('\n').filter(l=>l.trim().length>0);
  const shortRatio=lines.filter(l=>l.trim().length<45).length/Math.max(lines.length,1);
  if(shortRatio<0.55)return text;
  try{const words=text.split(/\s+/),chunks=[];for(let i=0;i<words.length;i+=300)chunks.push(words.slice(i,i+300).join(' '));const cleaned=[];for(const ch of chunks){const{text:t}=await AI.chat([{role:'system',content:P_PDF},{role:'user',content:ch}],{maxTokens:600});cleaned.push(t);}return cleaned.join('\n\n');}catch{return text;}
}

async function autoEnrichVocab(lesson){
  /* batch-translate vocab words not in HD and not already cached */
  if(!AI.hasAnyRoute())return;
  const missing=lesson.allVocab.filter(w=>!HD[w]&&!SCOPE.get('ah.'+w,null));
  if(!missing.length)return;
  const batches=[];for(let i=0;i<missing.length;i+=20)batches.push(missing.slice(i,i+20));
  for(const batch of batches){
    try{
      const{text}=await AI.chat([{role:'system',content:P_VOCAB_BATCH},{role:'user',content:batch.join(', ')}],{maxTokens:400});
      const data=gJSON(text);
      if(data&&typeof data==='object'){Object.entries(data).forEach(([word,hindi])=>{if(word&&hindi)SCOPE.set('ah.'+word.toLowerCase(),String(hindi));});}
    }catch{/* silent */}
  }
}

async function enrichWord(word){
  const key='wc.'+word.toLowerCase();const cached=SCOPE.get(key,null);if(cached)return cached;
  if(!AI.hasAnyRoute())return null;
  try{const{text}=await AI.chat([{role:'system',content:P_WORD},{role:'user',content:word}],{maxTokens:300});const data=gJSON(text);if(data&&data.synonyms){SCOPE.set(key,data);return data;}return null;}catch{return null;}
}

async function aiQuestions(lessonText){
  if(!AI.hasAnyRoute())return staticQuestions(lessonText);
  try{const{text}=await AI.chat([{role:'system',content:P_QUIZ},{role:'user',content:lessonText.slice(0,2000)}],{maxTokens:700});const qs=gJSON(text);if(Array.isArray(qs)&&qs.length)return qs;return staticQuestions(lessonText);}catch{return staticQuestions(lessonText);}
}

function staticQuestions(text){
  const vocab=[...new Set((text.match(/\b[a-zA-Z]{7,}\b/g)||[]).filter(w=>!CW.has(w.toLowerCase())).map(w=>w.toLowerCase()))].slice(0,8);
  const sents=tokenizeSentences(text);const qs=[];
  for(const sent of sents){const word=vocab.find(w=>sent.toLowerCase().includes(w));if(word&&(sent.match(/\b\w+\b/g)||[]).length>=6&&qs.length<3){const blanked=sent.replace(new RegExp('\\b'+word+'\\b','gi'),'_____');const wrong=vocab.filter(w=>w!==word).slice(0,3);if(!wrong.length)continue;const opts=[...[word,...wrong]].sort(()=>Math.random()-.5).slice(0,4);qs.push({q:blanked,options:opts,answer:word,explain:'"'+word+'" fits the context.'});}}
  return qs;
}

/* ── Text processor ───────────────────────────────────────────── */
function processText(raw,title){const clean=cleanText(raw);const chunks=chunkText(clean).map(analyzeChunk);return buildLesson(chunks,title||autoTitle(clean));}
function cleanText(raw){return raw.replace(/\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/g,'').replace(/^[A-Z][A-Za-z\s]{0,25}:\s*/gm,'').replace(/<[^>]+>/g,' ').replace(/[ \t]+/g,' ').replace(/\r\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();}
function chunkText(text){const p=text.split(/\n\n+/).map(x=>x.replace(/\n/g,' ').trim()).filter(x=>x.length>30);if(p.length>=2)return p;const s=tokenizeSentences(text),out=[];for(let i=0;i<s.length;i+=3){const c=s.slice(i,i+3).join(' ').trim();if(c.length>20)out.push(c);}return out.length?out:[text];}
function tokenizeSentences(text){return text.replace(/([.!?])\s+(?=[A-Z"'])/g,'$1|||').split('|||').map(s=>s.trim()).filter(s=>s.length>8);}
function analyzeChunk(rawText){
  /* explicit variable name avoids any possible shadowing */
  const chunkText2=String(rawText||'');
  const sentences=tokenizeSentences(chunkText2),words=chunkText2.match(/\b[a-zA-Z]+\b/g)||[];
  const patterns=sentences.filter(s=>(s.match(/\b\w+\b/g)||[]).length>=12);
  const vocab=[...new Set(words.filter(w=>w.length>=7&&!CW.has(w.toLowerCase())).map(w=>w.toLowerCase()))].slice(0,10);
  const lower=chunkText2.toLowerCase(),phrases=CP.filter(p=>lower.includes(p));
  return{text:chunkText2,sentences,patterns,vocab,phrases};
}
function buildLesson(chunks,title){return{id:'les_'+gId(),title,createdAt:Date.now(),status:'unread',chunks,allVocab:[...new Set(chunks.flatMap(c=>c.vocab))],allPhrases:[...new Set(chunks.flatMap(c=>c.phrases))],allPatterns:chunks.flatMap(c=>c.patterns),questions:[]};}
function autoTitle(text){const f=tokenizeSentences(text)[0]||text;return f.slice(0,60).trim()+(f.length>60?'…':'');}

/* ── renderWords: module-level text highlighter ───────────────── */
/* NOTE: the Words TAB renderer is named renderWordBank() inside init() */
function renderWords(text,wb,know){
  if(text==null||typeof text!=='string'||!text.trim())return'';
  return text.replace(/\b([a-zA-Z]+)\b/g,m=>{
    const k=m.toLowerCase(),hi=getHindi(k),sv=wb.has(k),kn=know[k];
    return '<span class="gw'+(hi?' known':'')+(sv?' saved':'')+(kn&&kn.count>2?' freq':'')+'" data-word="'+k+'">'+esc(m)+'</span>';
  });
}

/* ── Knowledge base ───────────────────────────────────────────── */
function updateKnowledge(words,sourceId){const k=SCOPE.get('knowledge',{});const now=Date.now();for(const w of words){const key=w.toLowerCase();const prev=k[key]||{word:key,count:0,sourceIds:[],firstSeen:now,lastSeen:now};k[key]={...prev,count:prev.count+1,lastSeen:now,sourceIds:[...new Set([...(prev.sourceIds||[]),sourceId])]};}SCOPE.set('knowledge',k);return k;}

/* ── Data helpers ─────────────────────────────────────────────── */
const gLessons=()=>SCOPE.get('lessons',[]);
const gWordbank=()=>SCOPE.get('wordbank',[]);
const gNotes=()=>SCOPE.get('notes',[]);
const gKnow=()=>SCOPE.get('knowledge',{});
function sLesson(l){SCOPE.set('lessons',[l,...gLessons().filter(x=>x.id!==l.id)]);}
function dLesson(id){SCOPE.set('lessons',gLessons().filter(l=>l.id!==id));}
function sWord(w){SCOPE.set('wordbank',[w,...gWordbank().filter(x=>x.id!==w.id)]);}
function dWord(id){SCOPE.set('wordbank',gWordbank().filter(w=>w.id!==id));}
function sNote(n){SCOPE.set('notes',[...gNotes().filter(x=>x.id!==n.id),n].sort((a,b)=>a.pageNum-b.pageNum));}
function dNote(id){SCOPE.set('notes',gNotes().filter(n=>n.id!==id));}

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
export default async function init({root,module:mod}){

  const elGate=root.querySelector('#guts-gate');
  const elMain=root.querySelector('#guts-main');
  const elContent=root.querySelector('#guts-content');
  const elAiDot=root.querySelector('#guts-ai-status');
  const popup=root.querySelector('#guts-word-popup');

  let tab=SCOPE.get('tab','home'),lessonId=null,noteId=null,drillMode=false,saveTimer=null,noteFontIdx=1;
  let autoMode=false; /* auto story mode toggle */

  function setAiDot(){if(!elAiDot)return;const on=AI.hasAnyRoute();elAiDot.textContent=on?'● AI ON':'● AI OFF';elAiDot.className='mono'+(on?' guts-ai-on':' guts-ai-off');}

  /* ── PIN gate ─────────────────────────────────────────────── */
  let pinEntry='',pinAttempts=0,pinLocked=false,pinMode='',setup1='';
  const storedHash=()=>SCOPE.get('pinHash',null);
  const hasPin=()=>!!storedHash();

  function initGate(){
    pinEntry='';pinMode=hasPin()?'verify':'setup-1';
    const lbl=root.querySelector('#guts-gate-label'),sub=root.querySelector('#guts-gate-sub'),rr=root.querySelector('#guts-pin-reset-row');
    if(!hasPin()){if(lbl)lbl.textContent='SET A 6-DIGIT PASSWORD';if(sub)sub.textContent='FIRST TIME SETUP';if(rr)rr.classList.add('hide');}
    else{if(lbl)lbl.textContent='ENTER 6-DIGIT PASSWORD';if(sub)sub.textContent='ENTER PASSWORD';if(rr)rr.classList.remove('hide');}
    updateDots();
  }
  function updateDots(){root.querySelectorAll('#guts-pin-dots .pin-dot').forEach((d,i)=>{d.classList.toggle('filled',i<pinEntry.length);d.classList.toggle('active',i===pinEntry.length);});}
  async function handleDigit(n){if(pinLocked||pinEntry.length>=6)return;const err=root.querySelector('#guts-pin-error');if(err)err.textContent='';pinEntry+=n;updateDots();if(pinEntry.length===6)await checkPin();}
  async function checkPin(){
    const err=root.querySelector('#guts-pin-error');const hash=await sha256(pinEntry);
    if(pinMode==='setup-1'){setup1=hash;pinMode='setup-2';const lbl=root.querySelector('#guts-gate-label');if(lbl)lbl.textContent='CONFIRM YOUR PASSWORD';pinEntry='';updateDots();return;}
    if(pinMode==='setup-2'){if(hash!==setup1){if(err)err.textContent='Passwords do not match';pinEntry='';updateDots();return;}SCOPE.set('pinHash',hash);unlock();return;}
    if(hash===storedHash()){pinAttempts=0;unlock();}
    else{pinAttempts++;pinEntry='';updateDots();if(pinAttempts>=3){pinLocked=true;if(err)err.textContent='Too many attempts — wait 30s';setTimeout(()=>{pinLocked=false;pinAttempts=0;if(err)err.textContent='';},30000);}else{if(err)err.textContent='Wrong password ('+(3-pinAttempts)+' left)';}}
  }
  function unlock(){elGate.classList.add('hide');elMain.classList.remove('hide');setAiDot();route(tab);}
  function lock(){stopSpeech();elMain.classList.add('hide');elGate.classList.remove('hide');clearTimeout(saveTimer);pinEntry='';pinAttempts=0;initGate();}

  root.querySelectorAll('#guts-numpad .num-btn[data-n]').forEach(btn=>btn.addEventListener('click',()=>handleDigit(btn.dataset.n)));
  const okBtn=root.querySelector('#guts-pin-ok');if(okBtn)okBtn.addEventListener('click',async()=>{if(pinEntry.length===6)await checkPin();});
  const clrBtn=root.querySelector('#guts-pin-clear');if(clrBtn)clrBtn.addEventListener('click',()=>{pinEntry=pinEntry.slice(0,-1);updateDots();});
  const rstBtn=root.querySelector('#guts-pin-reset');if(rstBtn)rstBtn.addEventListener('click',()=>{if(!confirm('Reset password? All GUTS data will be deleted.'))return;['pinHash','lessons','wordbank','notes','knowledge'].forEach(k=>SCOPE.remove(k));initGate();toast('Password reset');});
  const lkBtn=root.querySelector('#guts-lock-btn');if(lkBtn)lkBtn.addEventListener('click',lock);
  root.querySelectorAll('.guts-tab').forEach(btn=>btn.addEventListener('click',()=>route(btn.dataset.tab)));

  /* popup buttons */
  if(popup){
    popup.querySelector('#gwp-close').addEventListener('click',()=>popup.classList.add('hide'));
    popup.querySelector('#gwp-listen').addEventListener('click',()=>{const w=popup.querySelector('#gwp-word').dataset.word;if(w)speakText(w,_rate);});
    popup.querySelector('#gwp-save').addEventListener('click',()=>{
      const w=popup.querySelector('#gwp-word').dataset.word;if(!w)return;
      const les=gLessons().find(l=>l.id===lessonId);
      sWord({id:'w_'+gId(),word:w,hindi:getHindi(w),example:findEx(les,w),savedAt:Date.now(),lastReviewed:Date.now()});
      popup.querySelector('#gwp-save').textContent='✓ Saved';popup.querySelector('#gwp-save').disabled=true;toast('✓ Saved to word bank');
    });
    popup.querySelector('#gwp-enrich-btn').addEventListener('click',async()=>{
      const w=popup.querySelector('#gwp-word').dataset.word;if(!w)return;
      const btn=popup.querySelector('#gwp-enrich-btn');btn.textContent='⏳';btn.disabled=true;
      const data=await enrichWord(w);
      if(data){popup.querySelector('#gwp-synonyms').innerHTML='<div>'+data.synonyms.join(' · ')+'</div>'+data.sentences.map(s=>'<div style="color:var(--muted);font-size:10px;margin-top:3px;font-style:italic">'+esc(s)+'</div>').join('');popup.querySelector('#gwp-deva').textContent=data.devanagari.join(' · ');btn.textContent='✓ Done';}
      else{btn.textContent='No AI route';}
    });
  }

  initGate();

  /* ── Routing ─────────────────────────────────────────────── */
  function route(t){
    tab=t;SCOPE.set('tab',t);stopSpeech();
    root.querySelectorAll('.guts-tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===t));
    if(t==='upload')      renderUpload();
    else if(t==='library')renderLibrary();
    else if(t==='lesson') renderLesson();
    else if(t==='words')  renderWordBank(); /* ← RENAMED from renderWords */
    else if(t==='notes')  renderNotes();
    else if(t==='transfer')renderTransfer();
    else                  renderHome();
  }

  /* ── HOME ────────────────────────────────────────────────── */
  function renderHome(){
    const ls=gLessons(),wb=gWordbank();
    const unread=ls.filter(l=>l.status==='unread').length,done=ls.filter(l=>l.status==='done').length;
    const sevenD=7*24*60*60*1000,rev=wb.filter(w=>(Date.now()-(w.lastReviewed||w.savedAt))>sevenD);
    const latest=ls.find(l=>l.status!=='done')||ls[0];
    elContent.innerHTML=`
<div class="guts-stats">
  <div class="guts-stat"><span class="guts-stat__n">${ls.length}</span><span class="guts-stat__l">Lessons</span></div>
  <div class="guts-stat"><span class="guts-stat__n">${unread}</span><span class="guts-stat__l">Unread</span></div>
  <div class="guts-stat"><span class="guts-stat__n">${done}</span><span class="guts-stat__l">Done</span></div>
  <div class="guts-stat"><span class="guts-stat__n">${wb.length}</span><span class="guts-stat__l">Words</span></div>
</div>
${rev.length?`<div class="guts-review-banner" id="h-rev"><span>🔁</span><span><strong>${rev.length} word${rev.length>1?'s':''}</strong> ready for review — not seen in 7+ days</span><span class="guts-review-banner__arrow">→</span></div>`:''}
${latest?`<div class="guts-section">Continue reading</div>
<div class="guts-lesson-card featured" id="h-latest">
  <div class="guts-lesson-card__status ${sCls(latest.status)}">${sLbl(latest.status)}</div>
  <div class="guts-lesson-card__title">${esc(latest.title)}</div>
  <div class="guts-lesson-card__meta">${latest.chunks.length} chunks · ${latest.allVocab.length} vocab · ${gFmt(latest.createdAt)}</div>
  <div class="guts-lesson-card__arrow">→</div>
</div>`:`<div class="guts-empty"><div class="guts-empty__icon">📖</div>No lessons yet — upload some material</div>`}
<div class="guts-section" style="margin-top:20px">Quick actions</div>
<div class="guts-actions">
  <button class="guts-action-btn" id="ha-upload"><span class="guts-action-btn__icon">⬆</span>Upload</button>
  <button class="guts-action-btn" id="ha-library"><span class="guts-action-btn__icon">📚</span>Library</button>
  <button class="guts-action-btn" id="ha-words"><span class="guts-action-btn__icon">💡</span>Word Bank</button>
  <button class="guts-action-btn" id="ha-notes"><span class="guts-action-btn__icon">📝</span>Notes</button>
</div>`;
    elContent.querySelector('#ha-upload').addEventListener('click',()=>route('upload'));
    elContent.querySelector('#ha-library').addEventListener('click',()=>route('library'));
    elContent.querySelector('#ha-words').addEventListener('click',()=>route('words'));
    elContent.querySelector('#ha-notes').addEventListener('click',()=>route('notes'));
    const rb=elContent.querySelector('#h-rev');if(rb)rb.addEventListener('click',()=>route('words'));
    const lb=elContent.querySelector('#h-latest');if(lb)lb.addEventListener('click',()=>{lessonId=latest.id;route('lesson');});
  }

  /* ── UPLOAD ──────────────────────────────────────────────── */
  function renderUpload(){
    const aiOn=AI.hasAnyRoute();
    elContent.innerHTML=`
<label class="guts-label">Lesson title (optional)</label>
<input type="text" id="g-ul-title" class="guts-input" placeholder="Leave blank to auto-generate" maxlength="80">

<!-- Auto Story Mode toggle -->
<div class="guts-mode-row">
  <div class="guts-mode-label">Processing mode</div>
  <div class="guts-mode-btns">
    <button class="guts-mode-btn ${!autoMode?'active':''}" id="um-manual">⚙ Manual</button>
    <button class="guts-mode-btn ${autoMode?'active':''}" id="um-auto" ${!aiOn?'disabled title="Configure an AI key in Settings first"':''}>✨ Auto Story${!aiOn?' (needs AI)':''}</button>
  </div>
  ${autoMode&&aiOn?'<div class="guts-mode-hint">AI will rewrite content as a Deep English story lesson</div>':''}
</div>

<!-- Source tabs -->
<div class="guts-upload-tabs">
  <button class="guts-upload-tab active" id="ut-paste">✏ Paste text</button>
  <button class="guts-upload-tab" id="ut-file">📁 Upload file</button>
</div>

<!-- Paste panel -->
<div id="up-paste">
  <label class="guts-label">Any English text<span>article · transcript · story · any content</span></label>
  <textarea class="guts-textarea" id="g-paste" rows="9" placeholder="Paste your text here…"></textarea>
  <div class="guts-row" style="margin-top:6px">
    <button class="btn btn-primary" id="g-proc-paste">⚡ Process &amp; Save</button>
    <span style="font-size:9px;color:var(--dim);align-self:center" id="g-paste-cc">0 chars</span>
  </div>
</div>

<!-- File panel -->
<div id="up-file" class="hide">
  <label class="guts-label">Pick any file<span>PDF · DOCX · PPTX · TXT · VTT · SRT · any</span></label>
  <div class="guts-dropzone" id="g-dz">
    <span style="font-size:32px">📄</span>
    <span class="guts-dropzone__label">Tap to pick a file</span>
    <span class="guts-dropzone__hint">No format restrictions · PDF opens in browser · Text copies to paste area</span>
  </div>
  <div id="g-staging" class="hide"></div>
</div>

<div id="g-proc-status" class="hide" style="margin-top:10px;font-size:11px;color:var(--lime);display:flex;align-items:center;gap:8px">
  <span class="guts-spinner">◐</span><span id="g-proc-msg">Processing…</span>
</div>`;

    bindUpload();
  }

  function bindUpload(){
    /* Mode toggle */
    elContent.querySelector('#um-manual').addEventListener('click',()=>{autoMode=false;renderUpload();});
    elContent.querySelector('#um-auto').addEventListener('click',()=>{if(!AI.hasAnyRoute()){toast('Set an API key in ⚙ Settings first','');return;}autoMode=true;renderUpload();});

    /* Source tabs */
    elContent.querySelector('#ut-paste').addEventListener('click',e=>{e.currentTarget.classList.add('active');elContent.querySelector('#ut-file').classList.remove('active');elContent.querySelector('#up-paste').classList.remove('hide');elContent.querySelector('#up-file').classList.add('hide');});
    elContent.querySelector('#ut-file').addEventListener('click',e=>{e.currentTarget.classList.add('active');elContent.querySelector('#ut-paste').classList.remove('active');elContent.querySelector('#up-file').classList.remove('hide');elContent.querySelector('#up-paste').classList.add('hide');});

    /* Paste tab */
    const ta=elContent.querySelector('#g-paste'),cc=elContent.querySelector('#g-paste-cc');
    ta.addEventListener('input',()=>cc.textContent=ta.value.length.toLocaleString()+' chars');
    elContent.querySelector('#g-proc-paste').addEventListener('click',async()=>{
      const text=ta.value.trim(),title=elContent.querySelector('#g-ul-title').value.trim();
      if(text.length<30){toast('Paste at least 30 characters','');return;}
      await runProc(text,title);
    });

    /* File tab — smart staging */
    let _stagedFile=null,_stagedText='';
    const dz=elContent.querySelector('#g-dz');
    const staging=elContent.querySelector('#g-staging');

    dz.addEventListener('click',async()=>{
      const file=await pickFile('*/*');if(!file)return;
      setMsg(true,'Reading file…');
      try{
        let raw=await readFile(file);
        if(file.name.toLowerCase().endsWith('.pdf')){setMsg(true,'Analysing PDF layout…');raw=await aiCleanPdf(raw);}
        _stagedFile=file;_stagedText=raw;
        showStaging(file,raw,staging);
      }catch(e){toast('Could not read file: '+e.message,'');}
      finally{setMsg(false);}
    });

    function showStaging(file,text,stagingEl){
      const wc=wordCount(text),isSmall=wc<500,isPdf=file.name.toLowerCase().endsWith('.pdf');
      stagingEl.classList.remove('hide');
      stagingEl.innerHTML=`
<div class="guts-staging">
  <div class="guts-staging__header">
    <div class="guts-staging__name">${esc(file.name)}</div>
    <div class="guts-staging__meta">${wc.toLocaleString()} words · <span style="color:${isSmall?'var(--lime)':'var(--warn)'}">${isSmall?'small — can process directly':'large — pick how to use'}</span></div>
  </div>
  <pre class="guts-staging__preview">${esc(text.slice(0,350))}${text.length>350?'\n…':''}
  </pre>
  <div class="guts-staging__actions">
    ${isSmall?`<button class="btn btn-primary" id="st-direct">⚡ ${autoMode?'Story Mode':'Process'} → Library</button>`:''}
    <button class="btn" id="st-paste">📋 Use in Paste</button>
    ${isPdf?`<button class="btn" id="st-browser">🌐 Open PDF in Browser</button>`:''}
    <button class="btn btn-ghost" id="st-view">👁 View full text</button>
    ${!isSmall?`<button class="btn btn-primary" id="st-direct">⚡ ${autoMode?'Story Mode':'Process'} → Library</button>`:''}
  </div>
</div>`;

      /* Direct process */
      const stDirect=stagingEl.querySelector('#st-direct');
      if(stDirect)stDirect.addEventListener('click',()=>runProc(_stagedText,elContent.querySelector('#g-ul-title')?.value.trim()||''));

      /* Pre-fill paste area */
      stagingEl.querySelector('#st-paste').addEventListener('click',()=>{
        elContent.querySelector('#ut-paste').click();
        const ta2=elContent.querySelector('#g-paste');
        if(ta2){ta2.value=_stagedText;ta2.dispatchEvent(new Event('input'));}
        toast('✓ Text loaded into paste area — edit if needed');
      });

      /* Open PDF in browser */
      if(isPdf){stagingEl.querySelector('#st-browser').addEventListener('click',()=>{const url=URL.createObjectURL(_stagedFile);window.open(url,'_blank');setTimeout(()=>URL.revokeObjectURL(url),30000);});}

      /* Full text overlay */
      stagingEl.querySelector('#st-view').addEventListener('click',()=>showTextOverlay(_stagedText));
    }
  }

  function showTextOverlay(text){
    const ov=document.createElement('div');ov.className='guts-text-overlay';
    ov.innerHTML=`<div class="guts-text-overlay__inner"><div class="guts-text-overlay__bar"><span class="mono" style="font-size:9px;color:var(--muted);letter-spacing:.1em">FULL TEXT · ${wordCount(text).toLocaleString()} WORDS</span><button class="btn btn-primary btn-icon" id="ov-copy">📋 Copy all</button><button class="btn btn-ghost btn-icon" id="ov-close">✕ Close</button></div><pre class="guts-text-overlay__content">${esc(text)}</pre></div>`;
    document.body.appendChild(ov);
    ov.querySelector('#ov-copy').addEventListener('click',()=>{navigator.clipboard.writeText(text).then(()=>toast('✓ Copied to clipboard')).catch(()=>toast('Copy failed — select text manually',''));});
    ov.querySelector('#ov-close').addEventListener('click',()=>document.body.removeChild(ov));
  }

  function setMsg(on,msg){const el=elContent.querySelector('#g-proc-status'),tx=elContent.querySelector('#g-proc-msg');if(el)el.classList.toggle('hide',!on);if(tx&&msg)tx.textContent=msg;}
  const tick=()=>new Promise(r=>setTimeout(r,20));

  async function runProc(text,title){
    try{
      if(autoMode&&AI.hasAnyRoute()){setMsg(true,'✨ AI writing your Deep English story…');await tick();text=await aiStoryMode(text);}
      setMsg(true,'Analysing text…');await tick();
      const les=processText(text,title);
      setMsg(true,'Enriching vocabulary with Hindi…');
      await autoEnrichVocab(les);
      setMsg(true,'Generating comprehension questions…');
      les.questions=await aiQuestions(les.chunks.map(c=>c.text).join(' '));
      updateKnowledge(les.allVocab,les.id);
      sLesson(les);
      toast('✓ Saved — '+les.chunks.length+' chunks · '+les.allVocab.length+' vocab'+(autoMode?' · AI story mode':''));
      lessonId=les.id;route('lesson');
    }catch(e){toast('Failed: '+e.message,'');}
    finally{setMsg(false);}
  }

  /* ── LIBRARY ─────────────────────────────────────────────── */
  function renderLibrary(){
    const ls=gLessons();
    elContent.innerHTML='<div class="guts-section">'+ls.length+' LESSON'+(ls.length!==1?'S':'')+'</div>'+(ls.length===0?'<div class="guts-empty"><div class="guts-empty__icon">📚</div>No lessons yet</div>':ls.map(l=>'<div class="guts-lesson-card" data-id="'+esc(l.id)+'"><div class="guts-lesson-card__status '+sCls(l.status)+'">'+sLbl(l.status)+'</div><div class="guts-lesson-card__title">'+esc(l.title)+'</div><div class="guts-lesson-card__meta">'+l.chunks.length+' chunks · '+l.allVocab.length+' vocab · '+gFmt(l.createdAt)+'</div><div class="guts-lesson-card__arrow">→</div></div>').join(''));
    elContent.querySelectorAll('.guts-lesson-card').forEach(c=>c.addEventListener('click',()=>{lessonId=c.dataset.id;route('lesson');}));
  }

  /* ── LESSON READER ───────────────────────────────────────── */
  function findEx(lesson,word){const re=new RegExp('\\b'+word+'\\b','i');for(const c of(lesson?.chunks||[])){const m=c.sentences&&c.sentences.find(s=>re.test(s));if(m)return m.slice(0,100)+(m.length>100?'…':'');}return'';}

  function showPopup(word,lesson,wb){
    if(!popup)return;
    const hindi=getHindi(word),know=gKnow(),kn=know[word],saved=wb.has(word);
    popup.querySelector('#gwp-word').textContent=word;
    popup.querySelector('#gwp-word').dataset.word=word;
    popup.querySelector('#gwp-hindi').textContent=hindi||'— enriching…';
    popup.querySelector('#gwp-hindi').style.color=hindi?'var(--lime)':'var(--dim)';
    popup.querySelector('#gwp-freq').textContent=kn?'Seen '+kn.count+'× across '+kn.sourceIds.length+' source'+(kn.sourceIds.length>1?'s':''):'First time';
    const ex=findEx(lesson,word);popup.querySelector('#gwp-ex').textContent=ex?'"'+ex+'"':'';
    popup.querySelector('#gwp-save').textContent=saved?'✓ Saved':'+ Words';
    popup.querySelector('#gwp-save').disabled=saved;
    popup.querySelector('#gwp-synonyms').textContent='—';
    popup.querySelector('#gwp-deva').textContent='—';
    popup.querySelector('#gwp-enrich-btn').textContent='✨ Enrich';
    popup.querySelector('#gwp-enrich-btn').disabled=false;
    popup.classList.remove('hide');
    /* auto-fetch hindi if missing */
    if(!hindi&&AI.hasAnyRoute()){enrichWord(word).then(d=>{if(d)popup.querySelector('#gwp-hindi').textContent=d.devanagari?.[0]||'';});}
  }

  function renderLesson(){
    const les=gLessons().find(l=>l.id===lessonId);if(!les){route('library');return;}
    const wb=new Set(gWordbank().map(w=>w.word)),know=gKnow();
    elContent.innerHTML=`
<div style="background:var(--surface);border:0.5px solid var(--border);padding:12px 14px;margin-bottom:10px">
  <div class="guts-lesson-card__status ${sCls(les.status)}">${sLbl(les.status)}</div>
  <div style="font-family:var(--serif);font-size:20px;margin-bottom:4px">${esc(les.title)}</div>
  <div style="font-size:9px;color:var(--muted);margin-bottom:10px">${les.chunks.length} chunks · ${les.allVocab.length} vocab · ${gFmt(les.createdAt)}</div>
  <div class="guts-row">
    <button class="btn ${les.status==='done'?'btn-primary':''}" id="l-mark">${les.status==='done'?'✓ Done':'○ Mark done'}</button>
    <button class="btn btn-rust" id="l-del">✕ Delete</button>
    <button class="btn btn-ghost" id="l-back">← Library</button>
  </div>
</div>
<div class="guts-ra-bar">
  <button class="guts-ra-btn" id="g-ra-play">▶</button>
  <button class="guts-ra-btn" id="g-ra-pause" disabled>⏸</button>
  <button class="guts-ra-btn" id="g-ra-stop"  disabled>⏹</button>
  <div class="guts-ra-speeds">${[0.75,1,1.25,1.5].map(s=>`<button class="guts-ra-speed${_rate===s?' active':''}" data-rate="${s}">${s}×</button>`).join('')}</div>
</div>
<div class="guts-section">Story</div>
<div id="l-chunks">${les.chunks.map((c,i)=>{
  const chText=typeof c==='string'?c:(c&&c.text?c.text:'');
  return `<div class="guts-chunk" id="chunk-${i}"><div class="guts-chunk__num">§${i+1}</div><div class="guts-chunk__text">${renderWords(chText,wb,know)}</div>${(c&&c.phrases&&c.phrases.length)?`<div class="guts-chunk__phrases">${c.phrases.map(p=>'<span class="guts-badge">'+esc(p)+'</span>').join('')}</div>`:''}</div>`;
}).join('')}</div>
${les.allVocab.length?`<div class="guts-section">Key vocabulary</div><div class="guts-vocab-grid">${les.allVocab.map(w=>{const hi=getHindi(w),kn=know[w],sv=wb.has(w);return '<button class="guts-vocab-chip'+(sv?' saved':'')+'" data-word="'+esc(w)+'">'+esc(w)+(hi?'<span class="guts-vocab-chip__hi">'+esc(hi.split('(')[0].trim())+'</span>':'')+(kn&&kn.count>1?'<span class="guts-vocab-chip__freq">'+kn.count+'×</span>':'')+'</button>';}).join('')}</div>`:''}
${les.allPatterns.length?`<div class="guts-section">Long patterns <button class="guts-mini-btn" id="l-drill">◈ Drill</button></div><div id="l-patterns">${les.allPatterns.map((p,i)=>`<div class="guts-pattern" id="pat-${i}"><span style="color:var(--lime-dim)">◈</span><span class="guts-pattern__text">${esc(p)}</span><button class="guts-pattern__listen" data-text="${esc(p)}">▶</button></div>`).join('')}</div>`:''}
${les.allPhrases.length?`<div class="guts-section">Key phrases</div><div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">${les.allPhrases.map(p=>'<span class="guts-badge">'+esc(p)+'</span>').join('')}</div>`:''}
${les.questions&&les.questions.length?`<div class="guts-section">Comprehension check</div><div id="l-quiz"></div>`:''}`;

    elContent.querySelector('#l-back').addEventListener('click',()=>route('library'));
    elContent.querySelector('#l-del').addEventListener('click',()=>{if(!confirm('Delete "'+les.title+'"?'))return;dLesson(les.id);toast('Deleted');route('library');});
    elContent.querySelector('#l-mark').addEventListener('click',()=>{les.status=les.status==='done'?'reading':'done';sLesson(les);renderLesson();});
    elContent.querySelector('#l-chunks').addEventListener('click',e=>{const w=e.target.closest('.gw');if(w)showPopup(w.dataset.word,les,wb);else popup&&popup.classList.add('hide');});
    elContent.querySelectorAll('.guts-vocab-chip').forEach(c=>c.addEventListener('click',()=>showPopup(c.dataset.word,les,wb)));
    elContent.querySelectorAll('.guts-pattern__listen').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();speakText(b.dataset.text,_rate);}));
    const db=elContent.querySelector('#l-drill');if(db)db.addEventListener('click',()=>toggleDrill(db));
    if(les.questions&&les.questions.length){const qz=elContent.querySelector('#l-quiz');if(qz)renderQuiz(les.questions,qz);}
    /* Read aloud */
    const sents=les.chunks.flatMap(c=>{const t=typeof c==='string'?c:(c&&c.text?c.text:'');return tokenizeSentences(t);});
    elContent.querySelector('#g-ra-play').addEventListener('click',()=>{if(_pau){_pau=false;window.speechSynthesis.resume();_raSync();return;}speakText(sents.join(' '),_rate,idx=>{elContent.querySelectorAll('.guts-chunk').forEach(c=>c.classList.remove('speaking'));if(idx>=0){const c=elContent.querySelector('#chunk-'+Math.floor(idx/3));if(c)c.classList.add('speaking');}});});
    elContent.querySelector('#g-ra-pause').addEventListener('click',()=>{if(_pau){_pau=false;window.speechSynthesis.resume();}else{_pau=true;window.speechSynthesis.pause();}_raSync();});
    elContent.querySelector('#g-ra-stop').addEventListener('click',()=>{stopSpeech();elContent.querySelectorAll('.guts-chunk').forEach(c=>c.classList.remove('speaking'));});
    elContent.querySelectorAll('.guts-ra-speed').forEach(b=>b.addEventListener('click',()=>{_rate=parseFloat(b.dataset.rate);elContent.querySelectorAll('.guts-ra-speed').forEach(x=>x.classList.remove('active'));b.classList.add('active');if(_spk){stopSpeech();setTimeout(()=>speakText(sents.join(' '),_rate),80);}}));
    _raSync();
  }

  function toggleDrill(btn){drillMode=!drillMode;elContent.querySelectorAll('#l-patterns .guts-pattern').forEach(p=>{const span=p.querySelector('.guts-pattern__text');if(drillMode){span.dataset.orig=span.textContent;span.innerHTML='<span class="guts-drill-hidden">Tap to reveal</span>';span.addEventListener('click',function f(){span.textContent=span.dataset.orig;span.removeEventListener('click',f);},{once:true});}else{if(span.dataset.orig)span.textContent=span.dataset.orig;}});if(btn)btn.textContent=drillMode?'✕ Exit drill':'◈ Drill';}

  function renderQuiz(questions,el){
    el.innerHTML=questions.map((q,i)=>`<div class="guts-quiz-q"><div class="guts-quiz-sent">${esc(q.q||q.sentence||'')}</div><div class="guts-quiz-opts">${(q.options||[]).map(o=>`<button class="guts-quiz-opt" data-q="${i}" data-opt="${esc(o)}" data-ans="${esc(q.answer)}">${esc(o)}</button>`).join('')}</div><div class="guts-quiz-result" id="qr-${i}"></div></div>`).join('');
    el.querySelectorAll('.guts-quiz-opt').forEach(btn=>btn.addEventListener('click',()=>{const qi=btn.dataset.q,correct=btn.dataset.opt===btn.dataset.ans;elContent.querySelectorAll('.guts-quiz-opt[data-q="'+qi+'"]').forEach(b=>{b.disabled=true;if(b.dataset.opt===btn.dataset.ans)b.classList.add('correct');else if(b===btn)b.classList.add('wrong');});const res=elContent.querySelector('#qr-'+qi);if(res){res.textContent=correct?'✓ Correct!':'✗ Answer: '+btn.dataset.ans;res.style.color=correct?'var(--lime)':'var(--rust)';}});});
  }

  /* ── WORD BANK (renamed from renderWords to avoid collision) ── */
  function renderWordBank(){
    const wb=gWordbank().sort((a,b)=>b.savedAt-a.savedAt);
    const sevenD=7*24*60*60*1000;
    elContent.innerHTML='<div class="guts-section">'+wb.length+' SAVED WORD'+(wb.length!==1?'S':'')+'</div>'+(wb.length===0?'<div class="guts-empty"><div class="guts-empty__icon">💡</div>No words saved yet<br><span style="font-size:10px">Tap any word while reading a lesson</span></div>':
      wb.map(w=>{
        const review=(Date.now()-(w.lastReviewed||w.savedAt))>sevenD;
        const cached=SCOPE.get('wc.'+w.word,null);
        const autoHi=getHindi(w.word);
        return '<div class="guts-wb-card'+(review?' review':'')+'">'+
          '<div class="guts-wb-section-a"><div style="flex:1">'+
          (review?'<div class="guts-wb-review-badge">🔁 Review</div>':'')+
          '<div class="guts-wb-word">'+esc(w.word)+'</div>'+
          (autoHi?'<div class="guts-wb-hindi">'+esc(autoHi)+'</div>':'')+
          (w.example?'<div style="font-size:10px;color:var(--muted);font-style:italic;margin-top:3px">"'+esc(w.example)+'"</div>':'')+
          '<div style="font-size:8px;color:var(--dim);margin-top:4px">'+gFmt(w.savedAt)+'</div></div>'+
          '<div class="guts-wb-actions"><button class="guts-wb-btn wb-listen" data-word="'+esc(w.word)+'">▶</button><button class="guts-wb-btn del wb-del" data-id="'+esc(w.id)+'">✕</button></div></div>'+
          '<div class="guts-wb-section-b"><div class="guts-wb-section-label">EN · SIMILAR</div>'+
          (cached?'<div class="guts-wb-synonyms">'+esc(cached.synonyms.join(' · '))+'</div>'+cached.sentences.map(s=>'<div class="guts-wb-example">'+esc(s)+'</div>').join(''):
            '<button class="guts-enrich-trigger wb-enrich" data-word="'+esc(w.word)+'">✨ Tap to enrich via AI</button>')+
          '</div>'+
          '<div class="guts-wb-section-c"><div class="guts-wb-section-label" style="font-family:var(--mono)">HI · DEVANAGARI</div>'+
          (cached&&cached.devanagari?'<span style="font-family:\'Noto Sans Devanagari\',sans-serif">'+cached.devanagari.join(' · ')+'</span>':
            (autoHi?'<span style="font-family:\'Noto Sans Devanagari\',sans-serif;color:var(--muted)">'+esc(autoHi)+'</span>':
              '<span style="color:var(--dim);font-family:var(--mono);font-size:10px">— enrich to see phonetic</span>'))+
          '</div></div>';
      }).join(''));
    elContent.querySelectorAll('.wb-del').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();dWord(btn.dataset.id);toast('Word removed');renderWordBank();}));
    elContent.querySelectorAll('.wb-listen').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();const w=gWordbank().find(x=>x.word===btn.dataset.word);speakText(btn.dataset.word+(w&&w.hindi?' '+w.hindi:''),_rate);if(w){w.lastReviewed=Date.now();sWord(w);}}));
    elContent.querySelectorAll('.wb-enrich').forEach(btn=>btn.addEventListener('click',async e=>{e.stopPropagation();btn.textContent='⏳';btn.disabled=true;const data=await enrichWord(btn.dataset.word);if(data){toast('✓ Enriched');renderWordBank();}else{btn.textContent='No AI route';btn.disabled=false;toast('Set an API key in ⚙ Settings','');}}));
  }

  /* ── NOTES ───────────────────────────────────────────────── */
  function renderNotes(){
    const notes=gNotes(),active=noteId?notes.find(n=>n.id===noteId):notes[0];
    elContent.innerHTML='<div class="guts-pages-nav">'+notes.map((n,i)=>'<button class="guts-page-btn'+(active&&n.id===active.id?' active':'')+'\" data-nid="'+esc(n.id)+'">Page '+(i+1)+'</button>').join('')+'<button class="guts-page-btn add" id="n-add">+</button></div>'
    +(active?`<input type="text" class="guts-note-title" id="n-title" value="${esc(active.title)}" placeholder="Page title…" maxlength="60">
<div class="guts-rte-toolbar">
  <button class="guts-rte-btn" data-cmd="bold"><strong>B</strong></button>
  <button class="guts-rte-btn" data-cmd="heading">H</button>
  <button class="guts-rte-btn" data-cmd="highlight">◑</button>
  <button class="guts-rte-btn" data-cmd="preview" id="rte-prev">👁</button>
  <button class="guts-rte-btn" data-cmd="fontsize">aA</button>
  <label class="guts-rte-btn" style="cursor:pointer">📎<input type="file" id="n-attach" accept="image/*" hidden></label>
  <div style="flex:1"></div>
  <button class="guts-rte-btn ra" id="n-ra">▶ Read</button>
  <button class="guts-rte-btn del" id="n-del">✕</button>
</div>
<div class="guts-rte" id="n-rte" contenteditable="true" data-placeholder="Start writing your story or notes here…">${active.content||''}</div>
<div class="guts-note-footer"><span id="n-status" style="font-size:9px;color:var(--dim)">Auto-saved</span><span style="font-size:9px;color:var(--dim)">Updated ${gFmt(active.updatedAt||active.createdAt)}</span></div>`
    :'<div class="guts-empty"><div class="guts-empty__icon">📝</div>No pages yet — tap + to create one</div>');
    elContent.querySelectorAll('.guts-page-btn[data-nid]').forEach(b=>b.addEventListener('click',()=>{noteId=b.dataset.nid;renderNotes();}));
    elContent.querySelector('#n-add').addEventListener('click',()=>{const n={id:'note_'+gId(),pageNum:notes.length+1,title:'Page '+(notes.length+1),content:'',createdAt:Date.now(),updatedAt:Date.now()};sNote(n);noteId=n.id;renderNotes();});
    if(!active)return;
    const rte=elContent.querySelector('#n-rte'),titleEl=elContent.querySelector('#n-title'),status=elContent.querySelector('#n-status');
    const autoSave=()=>{active.content=rte.innerHTML;active.title=titleEl.value||'Page '+(notes.indexOf(active)+1);active.updatedAt=Date.now();sNote(active);if(status)status.textContent='Saved ✓';setTimeout(()=>{if(status)status.textContent='Auto-saved';},1500);const words=[...new Set((rte.innerText.match(/\b[a-zA-Z]{7,}\b/g)||[]).filter(w=>!CW.has(w.toLowerCase())).map(w=>w.toLowerCase()))];if(words.length)updateKnowledge(words,active.id);};
    rte.addEventListener('input',()=>{if(status)status.textContent='Unsaved…';clearTimeout(saveTimer);saveTimer=setTimeout(autoSave,1500);});
    titleEl.addEventListener('blur',autoSave);
    let prevMode=false;const fsSizes=['12px','14px','18px'];
    elContent.querySelectorAll('.guts-rte-btn[data-cmd]').forEach(btn=>{btn.addEventListener('click',()=>{rte.focus();const cmd=btn.dataset.cmd;if(cmd==='bold')document.execCommand('bold',false,null);else if(cmd==='heading')document.execCommand('formatBlock',false,'h3');else if(cmd==='highlight')document.execCommand('hiliteColor',false,'rgba(212,255,58,0.22)');else if(cmd==='preview'){prevMode=!prevMode;rte.contentEditable=prevMode?'false':'true';rte.style.background=prevMode?'var(--surface)':'';btn.classList.toggle('active',prevMode);}else if(cmd==='fontsize'){noteFontIdx=(noteFontIdx+1)%3;rte.style.fontSize=fsSizes[noteFontIdx];}});});
    elContent.querySelector('#n-attach').addEventListener('change',e=>{const file=e.target.files[0];if(!file)return;const r=new FileReader();r.onload=()=>{rte.focus();document.execCommand('insertHTML',false,'<img src="'+r.result+'" style="max-width:100%;margin:4px 0">');};r.readAsDataURL(file);e.target.value='';});
    elContent.querySelector('#n-del').addEventListener('click',()=>{if(!confirm('Delete "'+active.title+'"?'))return;dNote(active.id);noteId=null;toast('Page deleted');renderNotes();});
    elContent.querySelector('#n-ra').addEventListener('click',()=>{const text=rte.innerText||'';if(!text.trim()){toast('Nothing to read','');return;}speakText(text,_rate);});
  }

  /* ── TRANSFER ────────────────────────────────────────────── */
  function renderTransfer(){
    const ls=gLessons(),wb=gWordbank(),notes=gNotes(),know=gKnow();
    const aiOn=AI.hasAnyRoute();const providers=AI.getProviders()||{},order=AI.getFallbackOrder()||[];
    elContent.innerHTML=`
<div class="guts-section">Version</div>
<div class="frame subtle" style="padding:10px 14px;margin-bottom:12px"><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
  <div class="guts-info-row"><span class="guts-info-row__k">MODULE</span><span class="guts-info-row__v">Get Up To Speed</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">VERSION</span><span class="guts-info-row__v">v${MODULE_VERSION}</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">MOD NO.</span><span class="guts-info-row__v">09</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">GRAMMAR.AI</span><span class="guts-info-row__v">v1.4.5</span></div>
</div>
<div class="guts-section">AI Route Status</div>
<div class="frame subtle" style="padding:10px 14px;margin-bottom:12px"><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
  <div class="guts-info-row"><span class="guts-info-row__k">STATUS</span><span class="${aiOn?'guts-ai-on':'guts-ai-off'}" style="font-size:12px">${aiOn?'● READY':'○ NO KEY'}</span></div>
  ${order.map(id=>{const p=providers[id]||{},hasKey=!!AI.getKey(id);return '<div class="guts-info-row"><span class="guts-info-row__k">'+(p.icon||'')+' '+(p.label||id)+'</span><span style="font-size:11px;color:'+(hasKey?'var(--lime)':'var(--dim)')+'">'+(hasKey?'✓ Key set':'— no key')+'</span></div>';}).join('')}
  <div style="margin-top:6px;font-size:9px;color:var(--dim)">Configure keys in ⚙ Settings → API Keys</div>
</div>
<div class="guts-section">Data</div>
<div class="frame subtle" style="padding:10px 14px;margin-bottom:12px"><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
  <div class="guts-info-row"><span class="guts-info-row__k">LESSONS</span><span class="guts-info-row__v">${ls.length}</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">WORD BANK</span><span class="guts-info-row__v">${wb.length} words</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">NOTES</span><span class="guts-info-row__v">${notes.length} pages</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">KNOWLEDGE</span><span class="guts-info-row__v">${Object.keys(know).length} words</span></div>
</div>
<div class="guts-row" style="margin-bottom:8px">
  <button class="btn btn-primary" id="g-export">⬇ Export</button>
  <button class="btn" id="g-import">⬆ Import</button>
</div>
<div class="guts-section" style="margin-top:16px">Security</div>
<div class="frame subtle" style="padding:10px 14px"><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>
  <div class="guts-info-row"><span class="guts-info-row__k">LOCK</span><span class="guts-info-row__v">6-digit PIN · SHA-256</span></div>
  <div class="guts-info-row"><span class="guts-info-row__k">AUTO-LOCK</span><span class="guts-info-row__v">On module exit</span></div>
  <div style="margin-top:8px;display:flex;gap:6px">
    <button class="btn btn-ghost btn-icon" id="t-chpin" style="font-size:10px">⚙ Change PIN</button>
    <button class="btn btn-rust btn-icon" id="t-lock" style="font-size:10px">🔒 Lock now</button>
  </div>
</div>`;
    elContent.querySelector('#g-export').addEventListener('click',doExport);
    elContent.querySelector('#g-import').addEventListener('click',doImport);
    elContent.querySelector('#t-lock').addEventListener('click',lock);
    elContent.querySelector('#t-chpin').addEventListener('click',()=>{if(!confirm('Change PIN?'))return;SCOPE.remove('pinHash');lock();toast('PIN cleared — set a new one');});
  }

  function doExport(){if(!gLessons().length&&!gWordbank().length&&!gNotes().length){toast('Nothing to export yet','');return;}const data={_meta:{module:'Get Up To Speed',version:MODULE_VERSION,exportedAt:new Date().toISOString()},lessons:gLessons(),wordbank:gWordbank(),notes:gNotes(),knowledge:gKnow()};downloadFile('guts-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data,null,2),'application/json');toast('✓ Export downloaded');}
  async function doImport(){const file=await pickFile('.json,application/json');if(!file)return;try{const data=JSON.parse(await file.text());if(!data.lessons)throw new Error('Invalid GUTS backup');(data.lessons||[]).forEach(l=>sLesson(l));(data.wordbank||[]).forEach(w=>sWord(w));(data.notes||[]).forEach(n=>sNote(n));if(data.knowledge)SCOPE.set('knowledge',data.knowledge);toast('✓ Imported '+data.lessons.length+' lessons');renderTransfer();}catch(e){toast('Import failed: '+e.message,'');}}

  return{
    onShow(){setAiDot();},
    cleanup(){stopSpeech();lock();clearTimeout(saveTimer);}
  };
}
