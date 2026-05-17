/* GUTS · Get Up To Speed · v1.1.0 · MOD 09 */
import { $, esc, toast, downloadFile, pickFile } from '../../core/ui.js';
import { Storage } from '../../core/storage.js';
import { AI } from '../../core/ai.js';

const V = '1.1.0';
const SCOPE = Storage.scope('guts');

/* ── Prompts ─────────────────────────────────────────────────── */
const P_STORY = 'You are a Deep English language teacher inspired by Deep English (Aaron Campbell).\nTransform the given content into a rich story-style English learning lesson.\n- Write 4-6 natural paragraphs, each 3-5 sentences\n- Engaging narrative voice — learner feels they are reading a story\n- Preserve ALL key facts from the original\n- Mix short punchy sentences with longer flowing ones\n- Rich vocabulary naturally in context\n- Write for intermediate English learners (Indian audience)\n- Return ONLY the story text. No labels.';
const P_VOCAB = 'You are a Hindi-English vocabulary expert for Indian learners.\nGiven a comma-separated list of English words, return ONLY valid JSON:\n{"word1":"हिंदी अर्थ","word2":"हिंदी अर्थ"}\nRules: 1-4 words per meaning, most natural translation. If no Hindi equivalent, write phonetic Devanagari.\nReturn ONLY the JSON object. No markdown.';
const P_WORD = 'You are an English vocabulary expert for Indian learners. For the word given return ONLY valid JSON:\n{"synonyms":["w1","w2","w3"],"sentences":["Sentence 1.","Sentence 2."],"devanagari":["देवनागरी1","देवनागरी2","देवनागरी3"]}\nReturn ONLY the JSON object. No markdown.';
const P_PDF = 'You are a text reconstruction expert. This text was extracted from a PDF and may have column artifacts, broken lines, page numbers, headers. Reconstruct it as clean readable prose exactly as the author intended. Return ONLY the clean text.';
const P_QUIZ = 'You are an English comprehension teacher for Indian learners. Generate 3 multiple-choice questions from the text. Return ONLY valid JSON array:\n[{"q":"Question?","options":["a","b","c","d"],"answer":"a","explain":"Reason."}]\nNo markdown.';

/* ── Module-level data (must be before any function that uses it) */
const HD = {
  fluency:'प्रवाह',fluent:'धाराप्रवाह',vocabulary:'शब्द भंडार',grammar:'व्याकरण',pronunciation:'उच्चारण',communicate:'संवाद करना',conversation:'बातचीत',expression:'अभिव्यक्ति',language:'भाषा',understand:'समझना',practice:'अभ्यास',improve:'सुधारना',learning:'सीखना',knowledge:'ज्ञान',lesson:'पाठ',sentence:'वाक्य',meaning:'अर्थ',translate:'अनुवाद करना',comprehend:'समझना',articulate:'स्पष्ट बोलना',eloquent:'वाक्पटु',bilingual:'द्विभाषी',interpret:'व्याख्या करना',narrate:'वर्णन करना',describe:'वर्णन करना',explain:'समझाना',define:'परिभाषित करना',clarify:'स्पष्ट करना',emphasize:'जोर देना',summarize:'सारांश देना',elaborate:'विस्तार करना',illustrate:'चित्रित करना',simplify:'सरल करना',paraphrase:'दूसरे शब्दों में',transcript:'लिखित प्रति',
  confidence:'आत्मविश्वास',motivation:'प्रेरणा',resilience:'लचीलापन',perspective:'दृष्टिकोण',imagination:'कल्पना',creativity:'रचनात्मकता',awareness:'जागरूकता',mindset:'मानसिकता',potential:'क्षमता',discipline:'अनुशासन',patience:'धैर्य',commitment:'प्रतिबद्धता',consistent:'लगातार',progress:'प्रगति',achievement:'उपलब्धि',success:'सफलता',failure:'विफलता',challenge:'चुनौती',opportunity:'अवसर',experience:'अनुभव',wisdom:'बुद्धिमानी',intelligence:'बुद्धि',intuition:'अंतर्ज्ञान',perception:'अनुभूति',curiosity:'जिज्ञासा',determination:'दृढ़ संकल्प',perseverance:'दृढ़ता',ambition:'महत्वाकांक्षा',aspiration:'आकांक्षा',inspiration:'प्रेरणा',transformation:'परिवर्तन',evolution:'विकास',adaptation:'अनुकूलन',innovation:'नवाचार',breakthrough:'सफलता',overcome:'पार करना',accomplish:'प्राप्त करना',strive:'प्रयास करना',pursue:'अनुसरण करना',dedicate:'समर्पित करना',focus:'ध्यान',concentrate:'केंद्रित करना',reflect:'विचार करना',contemplate:'चिंतन करना',analyze:'विश्लेषण करना',evaluate:'मूल्यांकन करना',prioritize:'प्राथमिकता',organize:'व्यवस्थित करना',
  philosophy:'दर्शनशास्त्र',psychology:'मनोविज्ञान',spirituality:'आध्यात्मिकता',principle:'सिद्धांत',strategy:'रणनीति',process:'प्रक्रिया',effective:'प्रभावी',efficient:'कुशल',essential:'आवश्यक',important:'महत्वपूर्ण',valuable:'मूल्यवान',meaningful:'सार्थक',significant:'महत्वपूर्ण',fundamental:'मूलभूत',determine:'निर्धारित करना',establish:'स्थापित करना',demonstrate:'प्रदर्शित करना',recognize:'पहचानना',appreciate:'सराहना करना',theory:'सिद्धांत',concept:'अवधारणा',hypothesis:'परिकल्पना',argument:'तर्क',evidence:'प्रमाण',analysis:'विश्लेषण',interpretation:'व्याख्या',conclusion:'निष्कर्ष',assumption:'धारणा',consequence:'परिणाम',pattern:'पैटर्न',structure:'संरचना',framework:'ढांचा',mechanism:'तंत्र',phenomenon:'घटना',paradigm:'प्रतिमान',complexity:'जटिलता',diversity:'विविधता',inclusion:'समावेश',sustainability:'स्थिरता',integrity:'ईमानदारी',
  happiness:'खुशी',sadness:'दुख',excitement:'उत्साह',enthusiasm:'उत्साह',passion:'जुनून',compassion:'करुणा',empathy:'सहानुभूति',gratitude:'कृतज्ञता',forgiveness:'क्षमा',hope:'आशा',loneliness:'अकेलापन',contentment:'संतोष',frustration:'निराशा',satisfaction:'संतुष्टि',pride:'गर्व',shame:'शर्म',jealousy:'ईर्ष्या',admiration:'प्रशंसा',respect:'सम्मान',trust:'विश्वास',doubt:'संदेह',confusion:'भ्रम',surprise:'आश्चर्य',wonder:'आश्चर्य',nostalgia:'पुरानी यादें',melancholy:'उदासी',serenity:'शांति',tranquility:'शांति',overwhelmed:'अभिभूत',motivated:'प्रेरित',curious:'जिज्ञासु',nervous:'घबराया',grateful:'कृतज्ञ',anxious:'चिंतित',joyful:'आनंदित',peaceful:'शांतिपूर्ण',restless:'बेचैन',
  achieve:'प्राप्त करना',believe:'विश्वास करना',consider:'विचार करना',develop:'विकसित करना',encourage:'प्रोत्साहित करना',facilitate:'सुगम करना',generate:'उत्पन्न करना',implement:'लागू करना',investigate:'जांच करना',justify:'उचित ठहराना',maintain:'बनाए रखना',negotiate:'बातचीत करना',observe:'देखना',participate:'भाग लेना',respond:'जवाब देना',support:'समर्थन करना',utilize:'उपयोग करना',validate:'मान्य करना',acquire:'प्राप्त करना',collaborate:'सहयोग करना',contribute:'योगदान देना',coordinate:'समन्वय करना',create:'बनाना',debate:'बहस करना',examine:'जांच करना',explore:'खोज करना',identify:'पहचानना',integrate:'एकीकृत करना',manage:'प्रबंधन करना',monitor:'निगरानी करना',motivate:'प्रेरित करना',perform:'प्रदर्शन करना',promote:'बढ़ावा देना',publish:'प्रकाशित करना',suggest:'सुझाना',teach:'सिखाना',transform:'बदलना',verify:'सत्यापित करना',
  accurate:'सटीक',authentic:'प्रामाणिक',brilliant:'शानदार',capable:'सक्षम',decisive:'निर्णायक',dedicated:'समर्पित',flexible:'लचीला',focused:'केंद्रित',generous:'उदार',genuine:'वास्तविक',graceful:'कृपाशील',humble:'विनम्र',innovative:'अभिनव',insightful:'अंतर्दृष्टिपूर्ण',intentional:'जानबूझकर',logical:'तार्किक',methodical:'व्यवस्थित',objective:'वस्तुनिष्ठ',optimistic:'आशावादी',organized:'व्यवस्थित',persistent:'दृढ़',practical:'व्यावहारिक',proactive:'सक्रिय',productive:'उत्पादक',professional:'पेशेवर',reliable:'विश्वसनीय',resourceful:'साधन-संपन्न',responsible:'जिम्मेदार',sensitive:'संवेदनशील',sincere:'ईमानदार',skilled:'कुशल',strategic:'रणनीतिक',structured:'संरचित',systematic:'व्यवस्थित',thoughtful:'विचारशील',thorough:'संपूर्ण',versatile:'बहुमुखी',vibrant:'जीवंत',visionary:'दूरदर्शी',adaptive:'अनुकूलनीय',analytical:'विश्लेषणात्मक',collaborative:'सहयोगी',comprehensive:'व्यापक',constructive:'रचनात्मक',dynamic:'गतिशील',ethical:'नैतिक',
  moment:'पल',duration:'अवधि',century:'सदी',frequency:'आवृत्ति',distance:'दूरी',location:'स्थान',position:'स्थिति',direction:'दिशा',boundary:'सीमा',horizon:'क्षितिज',landscape:'परिदृश्य',territory:'क्षेत्र',atmosphere:'वातावरण',circumstance:'परिस्थिति',situation:'स्थिति',background:'पृष्ठभूमि',foundation:'नींव',origin:'उत्पत्ति',destination:'मंजिल',momentum:'गति',trajectory:'प्रक्षेपवक्र',
  ecosystem:'पारिस्थितिकी',biodiversity:'जैव विविधता',conservation:'संरक्षण',climate:'जलवायु',geography:'भूगोल',wilderness:'जंगल',vegetation:'वनस्पति',mountain:'पर्वत',river:'नदी',ocean:'महासागर',forest:'वन',season:'मौसम',rainfall:'वर्षा',temperature:'तापमान',organic:'जैविक',renewable:'नवीकरणीय',
  profession:'पेशा',career:'करियर',industry:'उद्योग',organization:'संगठन',management:'प्रबंधन',leadership:'नेतृत्व',productivity:'उत्पादकता',efficiency:'दक्षता',revenue:'राजस्व',investment:'निवेश',entrepreneurship:'उद्यमिता',infrastructure:'बुनियादी ढांचा',technology:'प्रौद्योगिकी',marketing:'विपणन',partnership:'साझेदारी',stakeholder:'हितधारक',deadline:'समय सीमा',milestone:'मील का पत्थर',feedback:'प्रतिक्रिया',performance:'प्रदर्शन',accountability:'जवाबदेही',transparency:'पारदर्शिता',governance:'शासन',compliance:'अनुपालन',implementation:'कार्यान्वयन',recommendation:'सिफारिश',
  wellness:'स्वास्थ्य',nutrition:'पोषण',meditation:'ध्यान',mindfulness:'सजगता',therapy:'चिकित्सा',diagnosis:'निदान',treatment:'उपचार',prevention:'रोकथाम',recovery:'स्वास्थ्य लाभ',immunity:'प्रतिरक्षा',consciousness:'चेतना',relaxation:'विश्राम',vitality:'जीवन शक्ति',stamina:'सहनशक्ति',endurance:'धीरज',strength:'शक्ति',balance:'संतुलन',breathing:'श्वास',healing:'उपचार',longevity:'दीर्घायु',lifestyle:'जीवन शैली',
  relationship:'संबंध',friendship:'मित्रता',community:'समुदाय',society:'समाज',culture:'संस्कृति',tradition:'परंपरा',heritage:'विरासत',equality:'समानता',justice:'न्याय',democracy:'लोकतंत्र',freedom:'स्वतंत्रता',responsibility:'जिम्मेदारी',mentorship:'मार्गदर्शन',cooperation:'सहयोग',tolerance:'सहिष्णुता',celebration:'उत्सव',recognition:'पहचान',encouragement:'प्रोत्साहन',guidance:'मार्गदर्शन',empowering:'सशक्त बनाना',
  platform:'मंच',strategy:'रणनीति',director:'निर्देशक',release:'रिलीज़',streaming:'स्ट्रीमिंग',content:'सामग्री',digital:'डिजिटल',global:'वैश्विक',market:'बाज़ार',company:'कंपनी',business:'व्यवसाय',production:'निर्माण',distribution:'वितरण',audience:'दर्शक',commercial:'व्यावसायिक',exclusive:'विशेष',original:'मूल',according:'अनुसार',upcoming:'आगामी',expected:'अपेक्षित',reported:'रिपोर्ट किया',announced:'घोषित',confirmed:'पुष्टि',signals:'संकेत',uncommon:'असामान्य',footprint:'उपस्थिति',blockbuster:'ब्लॉकबस्टर',filmmaker:'फिल्मनिर्माता',international:'अंतर्राष्ट्रीय',domestic:'घरेलू',theatrical:'थियेट्रिकल',franchise:'फ्रेंचाइज़',
};

const CW = new Set('the,be,to,of,and,a,in,that,have,it,for,not,on,with,he,as,you,do,at,this,but,his,by,from,they,we,say,her,she,or,an,will,my,one,all,would,there,their,what,so,up,out,if,about,who,get,which,go,me,when,make,can,like,time,no,just,him,know,take,people,into,year,your,good,some,could,them,see,other,than,then,now,look,only,come,its,over,think,also,back,after,use,two,how,our,work,first,well,way,even,new,want,because,any,these,give,day,most,need,often,hand,high,place,hold,turn,help,start,never,next,hard,open,seem,always,both,show,feel,long,those,old,face,tell,keep,every,find,much,still,though,should,where,does,around,three,small,set,put,end,another,right,big,too,many,before,must,through,under,little,being,while,become,already,against,without,same,different,however,between,might,going,great,here,were,been,used,said,each,more,very,made,such,once,away,down,film,films,was,are,has,had'.split(','));

const CP = ['get up to speed','bear in mind','keep in mind','on the other hand','in other words','as a result','for example','for instance','in addition','at the same time','in fact','as well as','more than ever','look forward to','take for granted','point of view','make a difference','come up with','put up with','at least','in order to','as long as','even though','in spite of','due to','according to','in terms of','take part in','make sure','find out','figure out','right away','after all','all of a sudden','once in a while','sooner or later','on the whole','as far as','in general','at first','to begin with','on top of that','as a matter of fact','in the long run','at the end of the day','when it comes to','in my opinion','based on','in contrast','get rid of','keep in touch','run out of','look up to','carry on','catch up','give up','move on','stand out','work out'];

/* ── Helpers ──────────────────────────────────────────────────── */
function gFmt(ts){return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'2-digit'}).format(new Date(ts));}
function gId(){return 'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);}
function gJSON(t){try{return JSON.parse(t.replace(/```json|```/g,'').trim());}catch{return null;}}
function sCls(s){return s==='done'?'s-done':s==='reading'?'s-reading':'s-unread';}
function sLbl(s){return s==='done'?'+ Done':s==='reading'?'> Reading':'o Unread';}
function wc(t){return (t.match(/\b\w+\b/g)||[]).length;}
function hindi(w){return HD[w]||SCOPE.get('ah.'+w,null)||'';}
async function sha256(t){const b=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(t));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join('');}

/* ── Speech ───────────────────────────────────────────────────── */
let _spk=false,_pau=false,_rate=1.0,_sents=[],_idx=0,_spkCb=null;
function speak(text,rate,cb){
  if(!('speechSynthesis' in window)){toast('Speech not supported');return;}
  stopSpeak();
  const ss=tokSents(strip(text));
  if(!ss.length)return;
  _sents=ss;_idx=0;_spk=true;_pau=false;_rate=rate||1;_spkCb=cb||null;_spkNext();
}
function _spkNext(){
  if(!_spk||_idx>=_sents.length){_spk=false;if(_spkCb)_spkCb(-1);_raSync();return;}
  if(_spkCb)_spkCb(_idx);
  const u=new SpeechSynthesisUtterance(_sents[_idx]);u.rate=_rate;u.lang='en-US';
  u.onend=()=>{_idx++;_spkNext();};u.onerror=()=>{_idx++;_spkNext();};
  window.speechSynthesis.speak(u);_raSync();
}
function stopSpeak(){_spk=false;_pau=false;if('speechSynthesis' in window)window.speechSynthesis.cancel();if(_spkCb){_spkCb(-1);_spkCb=null;}_raSync();}
function _raSync(){const pl=document.getElementById('g-ra-play'),pa=document.getElementById('g-ra-pause'),st=document.getElementById('g-ra-stop');if(!pl)return;pl.disabled=_spk&&!_pau;pa.disabled=!_spk||_pau;st.disabled=!_spk;pl.textContent=_pau?'> Resume':'>';}
function strip(h){const d=document.createElement('div');d.innerHTML=h;return d.innerText||d.textContent||'';}

/* ── File readers ─────────────────────────────────────────────── */
async function readFile(file){
  const n=file.name.toLowerCase();
  if(n.endsWith('.pdf'))return readPdf(file);
  if(n.endsWith('.docx'))return readDocx(file);
  if(n.endsWith('.pptx'))return readPptx(file);
  if(n.endsWith('.vtt'))return readVtt(await file.text());
  if(n.endsWith('.srt'))return readSrt(await file.text());
  try{return await file.text();}catch{throw new Error('Cannot read '+file.name);}
}
async function readPdf(file){
  const lib=window.pdfjsLib;if(!lib)throw new Error('PDF.js not loaded - reload the app');
  lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const buf=await file.arrayBuffer(),pdf=await lib.getDocument({data:buf}).promise;
  const pages=[];
  for(let i=1;i<=pdf.numPages;i++){
    const page=await pdf.getPage(i),content=await page.getTextContent();
    const items=content.items.filter(it=>it.str.trim());if(!items.length)continue;
    const xs=items.map(it=>it.transform[4]),mid=(Math.min(...xs)+Math.max(...xs))/2;
    const left=items.filter(it=>it.transform[4]<mid).map(it=>it.str).join(' ');
    const right=items.filter(it=>it.transform[4]>=mid).map(it=>it.str).join(' ');
    pages.push((left.length>50&&right.length>50)?left+'\n\n'+right:items.map(it=>it.str).join(' '));
  }
  return pages.join('\n\n').trim();
}
async function readDocx(file){const Z=window.JSZip;if(!Z)throw new Error('JSZip not loaded');const zip=await Z.loadAsync(file),xml=await zip.file('word/document.xml').async('text');return xml.replace(/<w:br[^>]*>/gi,'\n').replace(/<\/w:p>/gi,'\n').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\n{3,}/g,'\n\n').trim();}
async function readPptx(file){const Z=window.JSZip;if(!Z)throw new Error('JSZip not loaded');const zip=await Z.loadAsync(file),slides=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n)).sort();let text='';for(const s of slides){const xml=await zip.files[s].async('text');const t=xml.replace(/<a:t>/g,' ').replace(/<a:p[^>]*>/g,'\n').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();if(t)text+=t+'\n\n';}return text.trim();}
function readVtt(r){return r.split('\n').filter(l=>!l.match(/^WEBVTT|^\d+$|-->/)).join(' ').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();}
function readSrt(r){return r.replace(/^\d+\s*$/gm,'').replace(/\d{2}:\d{2}:\d{2},\d+\s*-->\s*\d{2}:\d{2}:\d{2},\d+/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();}

/* ── AI ───────────────────────────────────────────────────────── */
async function aiStory(text){
  if(!AI.hasAnyRoute())return text;
  try{
    if(wc(text)>800){const paras=text.split(/\n\n+/).filter(p=>p.trim().length>20),h=Math.ceil(paras.length/2);const[a,b]=await Promise.all([AI.chat([{role:'system',content:P_STORY},{role:'user',content:paras.slice(0,h).join('\n\n')}],{maxTokens:900}),AI.chat([{role:'system',content:P_STORY},{role:'user',content:paras.slice(h).join('\n\n')}],{maxTokens:900})]);return a.text+'\n\n'+b.text;}
    const{text:t}=await AI.chat([{role:'system',content:P_STORY},{role:'user',content:text}],{maxTokens:1200});return t||text;
  }catch{return text;}
}
async function aiCleanPdf(text){
  if(!AI.hasAnyRoute())return text;
  const lines=text.split('\n').filter(l=>l.trim());if(lines.filter(l=>l.trim().length<45).length/Math.max(lines.length,1)<0.55)return text;
  try{const words=text.split(/\s+/),chunks=[];for(let i=0;i<words.length;i+=300)chunks.push(words.slice(i,i+300).join(' '));const out=[];for(const ch of chunks){const{text:t}=await AI.chat([{role:'system',content:P_PDF},{role:'user',content:ch}],{maxTokens:600});out.push(t);}return out.join('\n\n');}catch{return text;}
}
async function autoHindi(lesson){
  if(!AI.hasAnyRoute())return;
  const miss=lesson.allVocab.filter(w=>!HD[w]&&!SCOPE.get('ah.'+w,null));if(!miss.length)return;
  const batches=[];for(let i=0;i<miss.length;i+=20)batches.push(miss.slice(i,i+20));
  for(const batch of batches){try{const{text}=await AI.chat([{role:'system',content:P_VOCAB},{role:'user',content:batch.join(', ')}],{maxTokens:400});const d=gJSON(text);if(d)Object.entries(d).forEach(([w,h])=>{if(w&&h)SCOPE.set('ah.'+w.toLowerCase(),String(h));});}catch{}}
}
async function enrichWord(word){
  const key='wc.'+word.toLowerCase();const cached=SCOPE.get(key,null);if(cached)return cached;
  if(!AI.hasAnyRoute())return null;
  try{const{text}=await AI.chat([{role:'system',content:P_WORD},{role:'user',content:word}],{maxTokens:300});const d=gJSON(text);if(d&&d.synonyms){SCOPE.set(key,d);return d;}return null;}catch{return null;}
}
async function aiQuiz(lessonText){
  if(!AI.hasAnyRoute())return staticQuiz(lessonText);
  try{const{text}=await AI.chat([{role:'system',content:P_QUIZ},{role:'user',content:lessonText.slice(0,2000)}],{maxTokens:700});const q=gJSON(text);if(Array.isArray(q)&&q.length)return q;return staticQuiz(lessonText);}catch{return staticQuiz(lessonText);}
}
function staticQuiz(text){
  const vocab=[...new Set((text.match(/\b[a-zA-Z]{7,}\b/g)||[]).filter(w=>!CW.has(w.toLowerCase())).map(w=>w.toLowerCase()))].slice(0,8);
  const sents=tokSents(text);const qs=[];
  for(const sent of sents){const word=vocab.find(w=>sent.toLowerCase().includes(w));if(word&&(sent.match(/\b\w+\b/g)||[]).length>=6&&qs.length<3){const bl=sent.replace(new RegExp('\\b'+word+'\\b','gi'),'_____');const wrong=vocab.filter(w=>w!==word).slice(0,3);if(!wrong.length)continue;const opts=[...[word,...wrong]].sort(()=>Math.random()-.5).slice(0,4);qs.push({q:bl,options:opts,answer:word,explain:'"'+word+'" fits.'});}}
  return qs;
}

/* ── Text processor ───────────────────────────────────────────── */
function procText(raw,title){const clean=cleanTxt(raw);const chunks=splitChunks(clean).map(mkChunk);return mkLesson(chunks,title||autoTitle(clean));}
function cleanTxt(raw){return raw.replace(/\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*/g,'').replace(/^[A-Z][A-Za-z\s]{0,25}:\s*/gm,'').replace(/<[^>]+>/g,' ').replace(/[ \t]+/g,' ').replace(/\r\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();}
function splitChunks(text){const p=text.split(/\n\n+/).map(x=>x.replace(/\n/g,' ').trim()).filter(x=>x.length>30);if(p.length>=2)return p;const s=tokSents(text),out=[];for(let i=0;i<s.length;i+=3){const c=s.slice(i,i+3).join(' ').trim();if(c.length>20)out.push(c);}return out.length?out:[text];}
function tokSents(text){return text.replace(/([.!?])\s+(?=[A-Z"'])/g,'$1|||').split('|||').map(s=>s.trim()).filter(s=>s.length>8);}
function mkChunk(rawText){
  const t=String(rawText||'');
  const sentences=tokSents(t),words=t.match(/\b[a-zA-Z]+\b/g)||[];
  const patterns=sentences.filter(s=>(s.match(/\b\w+\b/g)||[]).length>=12);
  const vocab=[...new Set(words.filter(w=>w.length>=7&&!CW.has(w.toLowerCase())).map(w=>w.toLowerCase()))].slice(0,10);
  const lower=t.toLowerCase(),phrases=CP.filter(p=>lower.includes(p));
  return{text:t,sentences,patterns,vocab,phrases};
}
function mkLesson(chunks,title){return{id:'les_'+gId(),title,createdAt:Date.now(),status:'unread',chunks,allVocab:[...new Set(chunks.flatMap(c=>c.vocab))],allPhrases:[...new Set(chunks.flatMap(c=>c.phrases))],allPatterns:chunks.flatMap(c=>c.patterns),questions:[]};}
function autoTitle(text){const f=tokSents(text)[0]||text;return f.slice(0,60).trim()+(f.length>60?'...':'');}

/* NOTE: renderWords is module-level text highlighter. The Words TAB uses renderWordBank() inside init() */
function renderWords(text,wb,know){
  if(!text||typeof text!=='string')return '';
  return text.replace(/\b([a-zA-Z]+)\b/g,function(m){
    var k=m.toLowerCase(),hi=hindi(k),sv=wb.has(k),kn=know[k];
    return '<span class="gw'+(hi?' known':'')+(sv?' saved':'')+(kn&&kn.count>2?' freq':'')+'" data-word="'+k+'">'+esc(m)+'</span>';
  });
}

/* ── Knowledge ────────────────────────────────────────────────── */
function updateKnow(words,src){const k=SCOPE.get('knowledge',{});const now=Date.now();for(const w of words){const key=w.toLowerCase();const prev=k[key]||{word:key,count:0,sourceIds:[],firstSeen:now,lastSeen:now};k[key]={...prev,count:prev.count+1,lastSeen:now,sourceIds:[...new Set([...(prev.sourceIds||[]),src])]};}SCOPE.set('knowledge',k);}

/* ── Data helpers ─────────────────────────────────────────────── */
const gL=()=>SCOPE.get('lessons',[]);
const gW=()=>SCOPE.get('wordbank',[]);
const gN=()=>SCOPE.get('notes',[]);
const gK=()=>SCOPE.get('knowledge',{});
function sL(l){SCOPE.set('lessons',[l,...gL().filter(x=>x.id!==l.id)]);}
function dL(id){SCOPE.set('lessons',gL().filter(l=>l.id!==id));}
function sW(w){SCOPE.set('wordbank',[w,...gW().filter(x=>x.id!==w.id)]);}
function dW(id){SCOPE.set('wordbank',gW().filter(w=>w.id!==id));}
function sN(n){SCOPE.set('notes',[...gN().filter(x=>x.id!==n.id),n].sort((a,b)=>a.pageNum-b.pageNum));}
function dN(id){SCOPE.set('notes',gN().filter(n=>n.id!==id));}

/* ═══════════════════════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════════════════════ */
export default async function init({root, module: mod}) {

  var elGate=root.querySelector('#guts-gate');
  var elMain=root.querySelector('#guts-main');
  var elC=root.querySelector('#guts-content');
  var elAI=root.querySelector('#guts-ai-status');
  var popup=root.querySelector('#guts-word-popup');
  var tab=SCOPE.get('tab','home'),lessonId=null,noteId=null,drillMode=false,saveTimer=null,fontIdx=1,autoMode=false;

  function setAI(){if(!elAI)return;var on=AI.hasAnyRoute();elAI.textContent=on?'* AI ON':'* AI OFF';elAI.className='mono'+(on?' guts-ai-on':' guts-ai-off');}

  /* ── PIN gate ─────────────────────────────────────────────── */
  var pinEntry='',pinTries=0,pinLocked=false,pinMode='',setup1='';
  function getHash(){return SCOPE.get('pinHash',null);}
  function hasPin(){return !!getHash();}

  function initGate(){
    pinEntry='';pinMode=hasPin()?'verify':'setup-1';
    var lbl=root.querySelector('#guts-gate-label'),sub=root.querySelector('#guts-gate-sub'),rr=root.querySelector('#guts-pin-reset-row');
    if(!hasPin()){if(lbl)lbl.textContent='SET A 6-DIGIT PASSWORD';if(sub)sub.textContent='FIRST TIME SETUP';if(rr)rr.classList.add('hide');}
    else{if(lbl)lbl.textContent='ENTER 6-DIGIT PASSWORD';if(sub)sub.textContent='ENTER PASSWORD';if(rr)rr.classList.remove('hide');}
    dotSync();
  }
  function dotSync(){root.querySelectorAll('#guts-pin-dots .pin-dot').forEach(function(d,i){d.classList.toggle('filled',i<pinEntry.length);d.classList.toggle('active',i===pinEntry.length);});}
  async function digit(n){if(pinLocked||pinEntry.length>=6)return;var err=root.querySelector('#guts-pin-error');if(err)err.textContent='';pinEntry+=n;dotSync();if(pinEntry.length===6)await checkPin();}
  async function checkPin(){
    var err=root.querySelector('#guts-pin-error');var hash=await sha256(pinEntry);
    if(pinMode==='setup-1'){setup1=hash;pinMode='setup-2';var lbl=root.querySelector('#guts-gate-label');if(lbl)lbl.textContent='CONFIRM YOUR PASSWORD';pinEntry='';dotSync();return;}
    if(pinMode==='setup-2'){if(hash!==setup1){if(err)err.textContent='Passwords do not match';pinEntry='';dotSync();return;}SCOPE.set('pinHash',hash);unlock();return;}
    if(hash===getHash()){pinTries=0;unlock();}
    else{pinTries++;pinEntry='';dotSync();if(pinTries>=3){pinLocked=true;if(err)err.textContent='Too many attempts - wait 30s';setTimeout(function(){pinLocked=false;pinTries=0;if(err)err.textContent='';},30000);}else{if(err)err.textContent='Wrong password ('+(3-pinTries)+' left)';}}
  }
  function unlock(){elGate.classList.add('hide');elMain.classList.remove('hide');setAI();route(tab);}
  function lock(){stopSpeak();elMain.classList.add('hide');elGate.classList.remove('hide');clearTimeout(saveTimer);pinEntry='';pinTries=0;initGate();}

  root.querySelectorAll('#guts-numpad .num-btn[data-n]').forEach(function(btn){btn.addEventListener('click',function(){digit(btn.dataset.n);});});
  var okBtn=root.querySelector('#guts-pin-ok');if(okBtn)okBtn.addEventListener('click',async function(){if(pinEntry.length===6)await checkPin();});
  var clrBtn=root.querySelector('#guts-pin-clear');if(clrBtn)clrBtn.addEventListener('click',function(){pinEntry=pinEntry.slice(0,-1);dotSync();});
  var rstBtn=root.querySelector('#guts-pin-reset');if(rstBtn)rstBtn.addEventListener('click',function(){if(!confirm('Reset password? All GUTS data will be deleted.'))return;['pinHash','lessons','wordbank','notes','knowledge'].forEach(function(k){SCOPE.remove(k);});initGate();toast('Password reset');});
  var lkBtn=root.querySelector('#guts-lock-btn');if(lkBtn)lkBtn.addEventListener('click',lock);
  root.querySelectorAll('.guts-tab').forEach(function(btn){btn.addEventListener('click',function(){route(btn.dataset.tab);});});

  /* popup button bindings */
  if(popup){
    popup.querySelector('#gwp-close').addEventListener('click',function(){popup.classList.add('hide');});
    popup.querySelector('#gwp-listen').addEventListener('click',function(){var w=popup.querySelector('#gwp-word').dataset.word;if(w)speak(w,_rate);});
    popup.querySelector('#gwp-save').addEventListener('click',function(){
      var w=popup.querySelector('#gwp-word').dataset.word;if(!w)return;
      var les=gL().find(function(l){return l.id===lessonId;});
      sW({id:'w_'+gId(),word:w,hindi:hindi(w),example:findEx(les,w),savedAt:Date.now(),lastReviewed:Date.now()});
      popup.querySelector('#gwp-save').textContent='Saved';popup.querySelector('#gwp-save').disabled=true;toast('Saved to word bank');
    });
    popup.querySelector('#gwp-enrich-btn').addEventListener('click',async function(){
      var w=popup.querySelector('#gwp-word').dataset.word;if(!w)return;
      var btn=popup.querySelector('#gwp-enrich-btn');btn.textContent='...';btn.disabled=true;
      var data=await enrichWord(w);
      if(data){
        popup.querySelector('#gwp-synonyms').innerHTML='<div>'+data.synonyms.join(' . ')+'</div>'+data.sentences.map(function(s){return '<div style="color:var(--muted);font-size:10px;margin-top:3px;font-style:italic">'+esc(s)+'</div>';}).join('');
        popup.querySelector('#gwp-deva').textContent=data.devanagari.join(' . ');
        btn.textContent='Done';
      }else{btn.textContent='No AI route';}
    });
  }

  initGate();

  /* ── Route ────────────────────────────────────────────────── */
  function route(t){
    tab=t;SCOPE.set('tab',t);stopSpeak();
    root.querySelectorAll('.guts-tab').forEach(function(b){b.classList.toggle('active',b.dataset.tab===t);});
    if(t==='upload')renderUpload();
    else if(t==='library')renderLibrary();
    else if(t==='lesson')renderLesson();
    else if(t==='words')renderWordBank();
    else if(t==='notes')renderNotes();
    else if(t==='transfer')renderTransfer();
    else renderHome();
  }

  /* ── HOME ────────────────────────────────────────────────── */
  function renderHome(){
    var ls=gL(),wb=gW(),unread=ls.filter(function(l){return l.status==='unread';}).length,done=ls.filter(function(l){return l.status==='done';}).length;
    var sevenD=7*24*60*60*1000,rev=wb.filter(function(w){return (Date.now()-(w.lastReviewed||w.savedAt))>sevenD;});
    var latest=ls.find(function(l){return l.status!=='done';})||ls[0];
    var html='<div class="guts-stats"><div class="guts-stat"><span class="guts-stat__n">'+ls.length+'</span><span class="guts-stat__l">Lessons</span></div><div class="guts-stat"><span class="guts-stat__n">'+unread+'</span><span class="guts-stat__l">Unread</span></div><div class="guts-stat"><span class="guts-stat__n">'+done+'</span><span class="guts-stat__l">Done</span></div><div class="guts-stat"><span class="guts-stat__n">'+wb.length+'</span><span class="guts-stat__l">Words</span></div></div>';
    if(rev.length)html+='<div class="guts-review-banner" id="h-rev"><span>Repeat</span><span><strong>'+rev.length+' word'+(rev.length>1?'s':'')+'</strong> ready for review</span><span class="guts-review-banner__arrow">-></span></div>';
    if(latest)html+='<div class="guts-section">Continue reading</div><div class="guts-lesson-card featured" id="h-latest"><div class="guts-lesson-card__status '+sCls(latest.status)+'">'+sLbl(latest.status)+'</div><div class="guts-lesson-card__title">'+esc(latest.title)+'</div><div class="guts-lesson-card__meta">'+latest.chunks.length+' chunks . '+latest.allVocab.length+' vocab . '+gFmt(latest.createdAt)+'</div><div class="guts-lesson-card__arrow">-></div></div>';
    else html+='<div class="guts-empty"><div class="guts-empty__icon">Book</div>No lessons yet</div>';
    html+='<div class="guts-section" style="margin-top:20px">Quick actions</div><div class="guts-actions"><button class="guts-action-btn" id="ha-up"><span class="guts-action-btn__icon">^</span>Upload</button><button class="guts-action-btn" id="ha-lib"><span class="guts-action-btn__icon">Lib</span>Library</button><button class="guts-action-btn" id="ha-wb"><span class="guts-action-btn__icon">W</span>Word Bank</button><button class="guts-action-btn" id="ha-n"><span class="guts-action-btn__icon">N</span>Notes</button></div>';
    elC.innerHTML=html;
    elC.querySelector('#ha-up').addEventListener('click',function(){route('upload');});
    elC.querySelector('#ha-lib').addEventListener('click',function(){route('library');});
    elC.querySelector('#ha-wb').addEventListener('click',function(){route('words');});
    elC.querySelector('#ha-n').addEventListener('click',function(){route('notes');});
    var rb=elC.querySelector('#h-rev');if(rb)rb.addEventListener('click',function(){route('words');});
    var lb=elC.querySelector('#h-latest');if(lb)lb.addEventListener('click',function(){lessonId=latest.id;route('lesson');});
  }

  /* ── UPLOAD ──────────────────────────────────────────────── */
  function renderUpload(){
    var aiOn=AI.hasAnyRoute();
    var html='<label class="guts-label">Lesson title (optional)</label><input type="text" id="g-ul-title" class="guts-input" placeholder="Leave blank to auto-generate" maxlength="80">';
    html+='<div class="guts-mode-row"><div class="guts-mode-label">Processing mode</div><div class="guts-mode-btns"><button class="guts-mode-btn'+(autoMode?'':' active')+'" id="um-manual">Manual</button><button class="guts-mode-btn'+(autoMode?' active':'')+'" id="um-auto"'+(aiOn?'':' disabled')+'>Auto Story'+(aiOn?'':' (needs AI)')+'</button></div>'+(autoMode&&aiOn?'<div class="guts-mode-hint">AI will rewrite as Deep English story</div>':'')+'</div>';
    html+='<div class="guts-upload-tabs"><button class="guts-upload-tab active" id="ut-paste">Paste text</button><button class="guts-upload-tab" id="ut-file">Upload file</button></div>';
    html+='<div id="up-paste"><label class="guts-label">Any English text<span> article . transcript . story</span></label><textarea class="guts-textarea" id="g-paste" rows="9" placeholder="Paste your text here..."></textarea><div class="guts-row" style="margin-top:6px"><button class="btn btn-primary" id="g-proc-paste">Process and Save</button><span style="font-size:9px;color:var(--dim);align-self:center" id="g-paste-cc">0 chars</span></div></div>';
    html+='<div id="up-file" class="hide"><label class="guts-label">Pick any file<span> PDF . DOCX . PPTX . TXT . VTT . SRT</span></label><div class="guts-dropzone" id="g-dz"><span style="font-size:32px">File</span><span class="guts-dropzone__label">Tap to pick a file</span><span class="guts-dropzone__hint">No format restrictions</span></div><div id="g-staging" class="hide"></div></div>';
    html+='<div id="g-proc-status" class="hide" style="margin-top:10px;font-size:11px;color:var(--lime);display:flex;align-items:center;gap:8px"><span class="guts-spinner">o</span><span id="g-proc-msg">Processing...</span></div>';
    elC.innerHTML=html;
    bindUpload();
  }

  function bindUpload(){
    elC.querySelector('#um-manual').addEventListener('click',function(){autoMode=false;renderUpload();});
    elC.querySelector('#um-auto').addEventListener('click',function(){if(!AI.hasAnyRoute()){toast('Set an API key in Settings first');return;}autoMode=true;renderUpload();});
    elC.querySelector('#ut-paste').addEventListener('click',function(e){e.currentTarget.classList.add('active');elC.querySelector('#ut-file').classList.remove('active');elC.querySelector('#up-paste').classList.remove('hide');elC.querySelector('#up-file').classList.add('hide');});
    elC.querySelector('#ut-file').addEventListener('click',function(e){e.currentTarget.classList.add('active');elC.querySelector('#ut-paste').classList.remove('active');elC.querySelector('#up-file').classList.remove('hide');elC.querySelector('#up-paste').classList.add('hide');});
    var ta=elC.querySelector('#g-paste'),cc=elC.querySelector('#g-paste-cc');
    ta.addEventListener('input',function(){cc.textContent=ta.value.length.toLocaleString()+' chars';});
    elC.querySelector('#g-proc-paste').addEventListener('click',async function(){
      var text=ta.value.trim(),title=elC.querySelector('#g-ul-title').value.trim();
      if(text.length<30){toast('Paste at least 30 characters');return;}
      await runProc(text,title);
    });
    var _ft='',_ff=null;
    var dz=elC.querySelector('#g-dz'),staging=elC.querySelector('#g-staging');
    dz.addEventListener('click',async function(){
      var file=await pickFile('*/*');if(!file)return;
      setMsg(true,'Reading file...');
      try{
        var raw=await readFile(file);
        if(file.name.toLowerCase().endsWith('.pdf')){setMsg(true,'Cleaning PDF...');raw=await aiCleanPdf(raw);}
        _ft=raw;_ff=file;
        showStaging(file,raw,staging);
      }catch(e){toast('Could not read file: '+e.message);}
      finally{setMsg(false);}
    });

    function showStaging(file,text,el){
      var words=wc(text),small=words<500,isPdf=file.name.toLowerCase().endsWith('.pdf');
      el.classList.remove('hide');
      var h='<div class="guts-staging"><div class="guts-staging__header"><div class="guts-staging__name">'+esc(file.name)+'</div><div class="guts-staging__meta">'+words.toLocaleString()+' words - '+(small?'small file':'large file - pick how to use')+'</div></div>';
      h+='<pre class="guts-staging__preview">'+esc(text.slice(0,350))+(text.length>350?'\n...':'')+'</pre>';
      h+='<div class="guts-staging__actions">';
      if(small)h+='<button class="btn btn-primary" id="st-direct">Process to Library</button>';
      h+='<button class="btn" id="st-paste">Use in Paste</button>';
      if(isPdf)h+='<button class="btn" id="st-browser">Open PDF in Browser</button>';
      h+='<button class="btn btn-ghost" id="st-view">View full text</button>';
      if(!small)h+='<button class="btn btn-primary" id="st-direct">Process to Library</button>';
      h+='</div></div>';
      el.innerHTML=h;
      var sd=el.querySelector('#st-direct');if(sd)sd.addEventListener('click',function(){runProc(_ft,elC.querySelector('#g-ul-title')&&elC.querySelector('#g-ul-title').value.trim()||'');});
      el.querySelector('#st-paste').addEventListener('click',function(){elC.querySelector('#ut-paste').click();var ta2=elC.querySelector('#g-paste');if(ta2){ta2.value=_ft;ta2.dispatchEvent(new Event('input'));}toast('Text loaded into paste area');});
      if(isPdf)el.querySelector('#st-browser').addEventListener('click',function(){var url=URL.createObjectURL(_ff);window.open(url,'_blank');setTimeout(function(){URL.revokeObjectURL(url);},30000);});
      el.querySelector('#st-view').addEventListener('click',function(){showOverlay(_ft);});
    }
  }

  function showOverlay(text){
    var ov=document.createElement('div');ov.className='guts-text-overlay';
    ov.innerHTML='<div class="guts-text-overlay__inner"><div class="guts-text-overlay__bar"><span class="mono" style="font-size:9px;color:var(--muted)">FULL TEXT - '+wc(text).toLocaleString()+' WORDS</span><button class="btn btn-primary btn-icon" id="ov-copy">Copy all</button><button class="btn btn-ghost btn-icon" id="ov-close">Close</button></div><pre class="guts-text-overlay__content">'+esc(text)+'</pre></div>';
    document.body.appendChild(ov);
    ov.querySelector('#ov-copy').addEventListener('click',function(){navigator.clipboard.writeText(text).then(function(){toast('Copied to clipboard');}).catch(function(){toast('Copy failed');});});
    ov.querySelector('#ov-close').addEventListener('click',function(){document.body.removeChild(ov);});
  }

  function setMsg(on,msg){var el=elC.querySelector('#g-proc-status'),tx=elC.querySelector('#g-proc-msg');if(el)el.classList.toggle('hide',!on);if(tx&&msg)tx.textContent=msg;}
  var tick=function(){return new Promise(function(r){setTimeout(r,20);});};

  async function runProc(text,title){
    try{
      if(autoMode&&AI.hasAnyRoute()){setMsg(true,'AI writing your Deep English story...');await tick();text=await aiStory(text);}
      setMsg(true,'Analysing text...');await tick();
      var les=procText(text,title);
      setMsg(true,'Enriching vocabulary...');await autoHindi(les);
      setMsg(true,'Generating comprehension questions...');
      les.questions=await aiQuiz(les.chunks.map(function(c){return c.text;}).join(' '));
      updateKnow(les.allVocab,les.id);sL(les);
      toast('Saved - '+les.chunks.length+' chunks - '+les.allVocab.length+' vocab'+(autoMode?' - AI story':''));
      lessonId=les.id;route('lesson');
    }catch(e){toast('Failed: '+e.message);}
    finally{setMsg(false);}
  }

  /* ── LIBRARY ─────────────────────────────────────────────── */
  function renderLibrary(){
    var ls=gL();
    var html='<div class="guts-section">'+ls.length+' LESSON'+(ls.length!==1?'S':'')+'</div>';
    if(!ls.length)html+='<div class="guts-empty"><div class="guts-empty__icon">Lib</div>No lessons yet</div>';
    else ls.forEach(function(l){html+='<div class="guts-lesson-card" data-id="'+esc(l.id)+'"><div class="guts-lesson-card__status '+sCls(l.status)+'">'+sLbl(l.status)+'</div><div class="guts-lesson-card__title">'+esc(l.title)+'</div><div class="guts-lesson-card__meta">'+l.chunks.length+' chunks . '+l.allVocab.length+' vocab . '+gFmt(l.createdAt)+'</div><div class="guts-lesson-card__arrow">-></div></div>';});
    elC.innerHTML=html;
    elC.querySelectorAll('.guts-lesson-card').forEach(function(c){c.addEventListener('click',function(){lessonId=c.dataset.id;route('lesson');});});
  }

  /* ── LESSON READER ───────────────────────────────────────── */
  function findEx(lesson,word){var re=new RegExp('\\b'+word+'\\b','i');for(var i=0;i<(lesson&&lesson.chunks||[]).length;i++){var c=lesson.chunks[i];var m=c.sentences&&c.sentences.find(function(s){return re.test(s);});if(m)return m.slice(0,100)+(m.length>100?'...':'');}return '';}

  function showPopup(word,lesson,wb){
    if(!popup)return;
    var hi=hindi(word),know=gK(),kn=know[word],saved=wb.has(word);
    popup.querySelector('#gwp-word').textContent=word;
    popup.querySelector('#gwp-word').dataset.word=word;
    popup.querySelector('#gwp-hindi').textContent=hi||'-- enriching...';
    popup.querySelector('#gwp-hindi').style.color=hi?'var(--lime)':'var(--dim)';
    popup.querySelector('#gwp-freq').textContent=kn?'Seen '+kn.count+' times':'First time';
    var ex=findEx(lesson,word);popup.querySelector('#gwp-ex').textContent=ex?'"'+ex+'"':'';
    popup.querySelector('#gwp-save').textContent=saved?'Saved':'+ Words';
    popup.querySelector('#gwp-save').disabled=saved;
    popup.querySelector('#gwp-synonyms').textContent='--';
    popup.querySelector('#gwp-deva').textContent='--';
    popup.querySelector('#gwp-enrich-btn').textContent='Enrich';
    popup.querySelector('#gwp-enrich-btn').disabled=false;
    popup.classList.remove('hide');
    if(!hi&&AI.hasAnyRoute()){enrichWord(word).then(function(d){if(d&&d.devanagari&&d.devanagari[0])popup.querySelector('#gwp-hindi').textContent=d.devanagari[0];});}
  }

  function renderLesson(){
    var les=gL().find(function(l){return l.id===lessonId;});if(!les){route('library');return;}
    var wb=new Set(gW().map(function(w){return w.word;})),know=gK();

    var html='<div style="background:var(--surface);border:0.5px solid var(--border);padding:12px 14px;margin-bottom:10px">';
    html+='<div class="guts-lesson-card__status '+sCls(les.status)+'">'+sLbl(les.status)+'</div>';
    html+='<div style="font-family:var(--serif);font-size:20px;margin-bottom:4px">'+esc(les.title)+'</div>';
    html+='<div style="font-size:9px;color:var(--muted);margin-bottom:10px">'+les.chunks.length+' chunks . '+les.allVocab.length+' vocab . '+gFmt(les.createdAt)+'</div>';
    html+='<div class="guts-row"><button class="btn'+(les.status==='done'?' btn-primary':'')+'" id="l-mark">'+(les.status==='done'?'Done':'Mark done')+'</button><button class="btn btn-rust" id="l-del">Delete</button><button class="btn btn-ghost" id="l-back">Library</button></div></div>';
    html+='<div class="guts-ra-bar"><button class="guts-ra-btn" id="g-ra-play">Play</button><button class="guts-ra-btn" id="g-ra-pause" disabled>Pause</button><button class="guts-ra-btn" id="g-ra-stop" disabled>Stop</button><div class="guts-ra-speeds">';
    [0.75,1,1.25,1.5].forEach(function(s){html+='<button class="guts-ra-speed'+(_rate===s?' active':'')+'" data-rate="'+s+'">'+s+'x</button>';});
    html+='</div></div>';
    html+='<div class="guts-section">Story</div><div id="l-chunks">';
    les.chunks.forEach(function(c,i){var t=typeof c==='string'?c:(c&&c.text?c.text:'');html+='<div class="guts-chunk" id="chunk-'+i+'"><div class="guts-chunk__num">S'+(i+1)+'</div><div class="guts-chunk__text">'+renderWords(t,wb,know)+'</div>';if(c&&c.phrases&&c.phrases.length){html+='<div class="guts-chunk__phrases">';c.phrases.forEach(function(p){html+='<span class="guts-badge">'+esc(p)+'</span>';});html+='</div>';}html+='</div>';});
    html+='</div>';
    if(les.allVocab.length){html+='<div class="guts-section">Key vocabulary</div><div class="guts-vocab-grid">';les.allVocab.forEach(function(w){var hi=hindi(w),kn=know[w],sv=wb.has(w);html+='<button class="guts-vocab-chip'+(sv?' saved':'')+'" data-word="'+esc(w)+'">'+esc(w);if(hi)html+='<span class="guts-vocab-chip__hi">'+esc(hi.split('(')[0].trim())+'</span>';if(kn&&kn.count>1)html+='<span class="guts-vocab-chip__freq">'+kn.count+'x</span>';html+='</button>';});html+='</div>';}
    if(les.allPatterns.length){html+='<div class="guts-section">Long patterns <button class="guts-mini-btn" id="l-drill">Drill</button></div><div id="l-patterns">';les.allPatterns.forEach(function(p,i){html+='<div class="guts-pattern" id="pat-'+i+'"><span style="color:var(--lime-dim)">+</span><span class="guts-pattern__text">'+esc(p)+'</span><button class="guts-pattern__listen" data-text="'+esc(p)+'">Play</button></div>';});html+='</div>';}
    if(les.allPhrases.length){html+='<div class="guts-section">Key phrases</div><div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px">';les.allPhrases.forEach(function(p){html+='<span class="guts-badge">'+esc(p)+'</span>';});html+='</div>';}
    if(les.questions&&les.questions.length)html+='<div class="guts-section">Comprehension check</div><div id="l-quiz"></div>';
    elC.innerHTML=html;

    elC.querySelector('#l-back').addEventListener('click',function(){route('library');});
    elC.querySelector('#l-del').addEventListener('click',function(){if(!confirm('Delete "'+les.title+'"?'))return;dL(les.id);toast('Deleted');route('library');});
    elC.querySelector('#l-mark').addEventListener('click',function(){les.status=les.status==='done'?'reading':'done';sL(les);renderLesson();});
    elC.querySelector('#l-chunks').addEventListener('click',function(e){var w=e.target.closest('.gw');if(w)showPopup(w.dataset.word,les,wb);else popup&&popup.classList.add('hide');});
    elC.querySelectorAll('.guts-vocab-chip').forEach(function(c){c.addEventListener('click',function(){showPopup(c.dataset.word,les,wb);});});
    elC.querySelectorAll('.guts-pattern__listen').forEach(function(b){b.addEventListener('click',function(e){e.stopPropagation();speak(b.dataset.text,_rate);});});
    var db=elC.querySelector('#l-drill');if(db)db.addEventListener('click',function(){toggleDrill(db);});
    if(les.questions&&les.questions.length){var qz=elC.querySelector('#l-quiz');if(qz)renderQuiz(les.questions,qz);}
    var sents=les.chunks.flatMap(function(c){var t=typeof c==='string'?c:(c&&c.text?c.text:'');return tokSents(t);});
    elC.querySelector('#g-ra-play').addEventListener('click',function(){
      if(_pau){_pau=false;window.speechSynthesis.resume();_raSync();return;}
      speak(sents.join(' '),_rate,function(idx){elC.querySelectorAll('.guts-chunk').forEach(function(c){c.classList.remove('speaking');});if(idx>=0){var c=elC.querySelector('#chunk-'+Math.floor(idx/3));if(c)c.classList.add('speaking');}});
    });
    elC.querySelector('#g-ra-pause').addEventListener('click',function(){if(_pau){_pau=false;window.speechSynthesis.resume();}else{_pau=true;window.speechSynthesis.pause();}_raSync();});
    elC.querySelector('#g-ra-stop').addEventListener('click',function(){stopSpeak();elC.querySelectorAll('.guts-chunk').forEach(function(c){c.classList.remove('speaking');});});
    elC.querySelectorAll('.guts-ra-speed').forEach(function(b){b.addEventListener('click',function(){_rate=parseFloat(b.dataset.rate);elC.querySelectorAll('.guts-ra-speed').forEach(function(x){x.classList.remove('active');});b.classList.add('active');if(_spk){stopSpeak();setTimeout(function(){speak(sents.join(' '),_rate);},80);}});});
    _raSync();
  }

  function toggleDrill(btn){
    drillMode=!drillMode;
    elC.querySelectorAll('#l-patterns .guts-pattern').forEach(function(p){
      var span=p.querySelector('.guts-pattern__text');
      if(drillMode){span.dataset.orig=span.textContent;span.innerHTML='<span class="guts-drill-hidden">Tap to reveal</span>';span.addEventListener('click',function handler(){span.textContent=span.dataset.orig;span.removeEventListener('click',handler);},{once:true});}
      else{if(span.dataset.orig)span.textContent=span.dataset.orig;}
    });
    if(btn)btn.textContent=drillMode?'Exit drill':'Drill';
  }

  function renderQuiz(questions,el){
    var html='';
    questions.forEach(function(q,i){
      html+='<div class="guts-quiz-q"><div class="guts-quiz-sent">'+esc(q.q||q.sentence||'')+'</div><div class="guts-quiz-opts">';
      (q.options||[]).forEach(function(o){html+='<button class="guts-quiz-opt" data-q="'+i+'" data-opt="'+esc(o)+'" data-ans="'+esc(q.answer)+'">'+esc(o)+'</button>';});
      html+='</div><div class="guts-quiz-result" id="qr-'+i+'"></div></div>';
    });
    el.innerHTML=html;
    el.querySelectorAll('.guts-quiz-opt').forEach(function(btn){
      btn.addEventListener('click',function(){
        var qi=btn.dataset.q,correct=btn.dataset.opt===btn.dataset.ans;
        elC.querySelectorAll('.guts-quiz-opt[data-q="'+qi+'"]').forEach(function(b){b.disabled=true;if(b.dataset.opt===btn.dataset.ans)b.classList.add('correct');else if(b===btn)b.classList.add('wrong');});
        var res=elC.querySelector('#qr-'+qi);if(res){res.textContent=correct?'Correct!':'Answer: '+btn.dataset.ans;res.style.color=correct?'var(--lime)':'var(--rust)';}
      });
    });
  }

  /* ── WORD BANK (renamed from renderWords to avoid shadowing) ── */
  function renderWordBank(){
    var wb=gW().sort(function(a,b){return b.savedAt-a.savedAt;});
    var sevenD=7*24*60*60*1000;
    var html='<div class="guts-section">'+wb.length+' SAVED WORD'+(wb.length!==1?'S':'')+'</div>';
    if(!wb.length){html+='<div class="guts-empty"><div class="guts-empty__icon">W</div>No words saved yet<br><span style="font-size:10px">Tap any word while reading a lesson</span></div>';}
    else{wb.forEach(function(w){
      var review=(Date.now()-(w.lastReviewed||w.savedAt))>sevenD;
      var cached=SCOPE.get('wc.'+w.word,null);
      var autoHi=hindi(w.word);
      html+='<div class="guts-wb-card'+(review?' review':'')+'">';
      html+='<div class="guts-wb-section-a"><div style="flex:1">';
      if(review)html+='<div class="guts-wb-review-badge">Repeat Review</div>';
      html+='<div class="guts-wb-word">'+esc(w.word)+'</div>';
      if(autoHi)html+='<div class="guts-wb-hindi">'+esc(autoHi)+'</div>';
      if(w.example)html+='<div style="font-size:10px;color:var(--muted);font-style:italic;margin-top:3px">"'+esc(w.example)+'"</div>';
      html+='<div style="font-size:8px;color:var(--dim);margin-top:4px">'+gFmt(w.savedAt)+'</div></div>';
      html+='<div class="guts-wb-actions"><button class="guts-wb-btn wb-listen" data-word="'+esc(w.word)+'">Play</button><button class="guts-wb-btn del wb-del" data-id="'+esc(w.id)+'">X</button></div></div>';
      html+='<div class="guts-wb-section-b"><div class="guts-wb-section-label">EN . SIMILAR</div>';
      if(cached)html+='<div class="guts-wb-synonyms">'+esc(cached.synonyms.join(' . '))+'</div>'+cached.sentences.map(function(s){return '<div class="guts-wb-example">'+esc(s)+'</div>';}).join('');
      else html+='<button class="guts-enrich-trigger wb-enrich" data-word="'+esc(w.word)+'">Enrich via AI</button>';
      html+='</div><div class="guts-wb-section-c"><div class="guts-wb-section-label" style="font-family:var(--mono)">HI . DEVANAGARI</div>';
      if(cached&&cached.devanagari)html+='<span style="font-family:\'Noto Sans Devanagari\',sans-serif">'+cached.devanagari.join(' . ')+'</span>';
      else if(autoHi)html+='<span style="font-family:\'Noto Sans Devanagari\',sans-serif;color:var(--muted)">'+esc(autoHi)+'</span>';
      else html+='<span style="color:var(--dim);font-size:10px">-- enrich to see phonetic</span>';
      html+='</div></div>';
    });}
    elC.innerHTML=html;
    elC.querySelectorAll('.wb-del').forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();dW(btn.dataset.id);toast('Word removed');renderWordBank();});});
    elC.querySelectorAll('.wb-listen').forEach(function(btn){btn.addEventListener('click',function(e){e.stopPropagation();var w=gW().find(function(x){return x.word===btn.dataset.word;});speak(btn.dataset.word+(w&&w.hindi?' '+w.hindi:''),_rate);if(w){w.lastReviewed=Date.now();sW(w);}});});
    elC.querySelectorAll('.wb-enrich').forEach(function(btn){btn.addEventListener('click',async function(e){e.stopPropagation();btn.textContent='...';btn.disabled=true;var data=await enrichWord(btn.dataset.word);if(data){toast('Enriched');renderWordBank();}else{btn.textContent='No AI route';btn.disabled=false;toast('Set an API key in Settings');}});});
  }

  /* ── NOTES ───────────────────────────────────────────────── */
  function renderNotes(){
    var notes=gN(),active=noteId?notes.find(function(n){return n.id===noteId;}):notes[0];
    var html='<div class="guts-pages-nav">';
    notes.forEach(function(n,i){html+='<button class="guts-page-btn'+(active&&n.id===active.id?' active':'')+'" data-nid="'+esc(n.id)+'">Page '+(i+1)+'</button>';});
    html+='<button class="guts-page-btn add" id="n-add">+</button></div>';
    if(active){
      html+='<input type="text" class="guts-note-title" id="n-title" value="'+esc(active.title)+'" placeholder="Page title..." maxlength="60">';
      html+='<div class="guts-rte-toolbar"><button class="guts-rte-btn" data-cmd="bold"><strong>B</strong></button><button class="guts-rte-btn" data-cmd="heading">H</button><button class="guts-rte-btn" data-cmd="highlight">Hi</button><button class="guts-rte-btn" data-cmd="preview" id="rte-prev">View</button><button class="guts-rte-btn" data-cmd="fontsize">aA</button><label class="guts-rte-btn" style="cursor:pointer">Attach<input type="file" id="n-attach" accept="image/*" hidden></label><div style="flex:1"></div><button class="guts-rte-btn ra" id="n-ra">Read</button><button class="guts-rte-btn del" id="n-del">Del</button></div>';
      html+='<div class="guts-rte" id="n-rte" contenteditable="true" data-placeholder="Start writing your story or notes here...">'+(active.content||'')+'</div>';
      html+='<div class="guts-note-footer"><span id="n-status" style="font-size:9px;color:var(--dim)">Auto-saved</span><span style="font-size:9px;color:var(--dim)">Updated '+gFmt(active.updatedAt||active.createdAt)+'</span></div>';
    }else{
      html+='<div class="guts-empty"><div class="guts-empty__icon">N</div>No pages yet - tap + to create one</div>';
    }
    elC.innerHTML=html;
    elC.querySelectorAll('.guts-page-btn[data-nid]').forEach(function(b){b.addEventListener('click',function(){noteId=b.dataset.nid;renderNotes();});});
    elC.querySelector('#n-add').addEventListener('click',function(){var n={id:'note_'+gId(),pageNum:notes.length+1,title:'Page '+(notes.length+1),content:'',createdAt:Date.now(),updatedAt:Date.now()};sN(n);noteId=n.id;renderNotes();});
    if(!active)return;
    var rte=elC.querySelector('#n-rte'),titleEl=elC.querySelector('#n-title'),status=elC.querySelector('#n-status');
    function autoSave(){active.content=rte.innerHTML;active.title=titleEl.value||'Page '+(notes.indexOf(active)+1);active.updatedAt=Date.now();sN(active);if(status)status.textContent='Saved';setTimeout(function(){if(status)status.textContent='Auto-saved';},1500);var words=[...new Set((rte.innerText.match(/\b[a-zA-Z]{7,}\b/g)||[]).filter(function(w){return !CW.has(w.toLowerCase());}).map(function(w){return w.toLowerCase();}))];if(words.length)updateKnow(words,active.id);}
    rte.addEventListener('input',function(){if(status)status.textContent='Unsaved...';clearTimeout(saveTimer);saveTimer=setTimeout(autoSave,1500);});
    titleEl.addEventListener('blur',autoSave);
    var prevMode=false;var fsSizes=['12px','14px','18px'];
    elC.querySelectorAll('.guts-rte-btn[data-cmd]').forEach(function(btn){btn.addEventListener('click',function(){rte.focus();var cmd=btn.dataset.cmd;if(cmd==='bold')document.execCommand('bold',false,null);else if(cmd==='heading')document.execCommand('formatBlock',false,'h3');else if(cmd==='highlight')document.execCommand('hiliteColor',false,'rgba(212,255,58,0.22)');else if(cmd==='preview'){prevMode=!prevMode;rte.contentEditable=prevMode?'false':'true';rte.style.background=prevMode?'var(--surface)':'';btn.classList.toggle('active',prevMode);}else if(cmd==='fontsize'){fontIdx=(fontIdx+1)%3;rte.style.fontSize=fsSizes[fontIdx];}});});
    elC.querySelector('#n-attach').addEventListener('change',function(e){var file=e.target.files[0];if(!file)return;var r=new FileReader();r.onload=function(){rte.focus();document.execCommand('insertHTML',false,'<img src="'+r.result+'" style="max-width:100%;margin:4px 0">');};r.readAsDataURL(file);e.target.value='';});
    elC.querySelector('#n-del').addEventListener('click',function(){if(!confirm('Delete "'+active.title+'"?'))return;dN(active.id);noteId=null;toast('Page deleted');renderNotes();});
    elC.querySelector('#n-ra').addEventListener('click',function(){var text=rte.innerText||'';if(!text.trim()){toast('Nothing to read');return;}speak(text,_rate);});
  }

  /* ── TRANSFER ────────────────────────────────────────────── */
  function renderTransfer(){
    var ls=gL(),wb=gW(),notes=gN(),know=gK();
    var aiOn=AI.hasAnyRoute();var providers=AI.getProviders()||{},order=AI.getFallbackOrder()||[];
    var html='<div class="guts-section">Version</div><div class="frame subtle" style="padding:10px 14px;margin-bottom:12px"><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">MODULE</span><span class="guts-info-row__v">Get Up To Speed</span></div>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">VERSION</span><span class="guts-info-row__v">v'+V+'</span></div>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">MOD NO.</span><span class="guts-info-row__v">09</span></div>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">GRAMMAR.AI</span><span class="guts-info-row__v">v1.4.5</span></div></div>';
    html+='<div class="guts-section">AI Status</div><div class="frame subtle" style="padding:10px 14px;margin-bottom:12px"><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">STATUS</span><span class="'+(aiOn?'guts-ai-on':'guts-ai-off')+'" style="font-size:12px">'+(aiOn?'READY':'NO KEY')+'</span></div>';
    order.forEach(function(id){var p=providers[id]||{},hasKey=!!AI.getKey(id);html+='<div class="guts-info-row"><span class="guts-info-row__k">'+(p.icon||'')+' '+(p.label||id)+'</span><span style="font-size:11px;color:'+(hasKey?'var(--lime)':'var(--dim)')+';">'+(hasKey?'Key set':'no key')+'</span></div>';});
    html+='<div style="margin-top:6px;font-size:9px;color:var(--dim)">Configure in Settings - API Keys</div></div>';
    html+='<div class="guts-section">Data</div><div class="frame subtle" style="padding:10px 14px;margin-bottom:12px"><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">LESSONS</span><span class="guts-info-row__v">'+ls.length+'</span></div>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">WORD BANK</span><span class="guts-info-row__v">'+wb.length+'</span></div>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">NOTES</span><span class="guts-info-row__v">'+notes.length+' pages</span></div>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">KNOWLEDGE</span><span class="guts-info-row__v">'+Object.keys(know).length+' words</span></div></div>';
    html+='<div class="guts-row" style="margin-bottom:8px"><button class="btn btn-primary" id="g-export">Export</button><button class="btn" id="g-import">Import</button></div>';
    html+='<div class="guts-section" style="margin-top:16px">Security</div><div class="frame subtle" style="padding:10px 14px"><span class="c tl"></span><span class="c tr"></span><span class="c bl"></span><span class="c br"></span>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">LOCK</span><span class="guts-info-row__v">6-digit PIN</span></div>';
    html+='<div class="guts-info-row"><span class="guts-info-row__k">AUTO-LOCK</span><span class="guts-info-row__v">On module exit</span></div>';
    html+='<div style="margin-top:8px;display:flex;gap:6px"><button class="btn btn-ghost btn-icon" id="t-chpin" style="font-size:10px">Change PIN</button><button class="btn btn-rust btn-icon" id="t-lock" style="font-size:10px">Lock now</button></div></div>';
    elC.innerHTML=html;
    elC.querySelector('#g-export').addEventListener('click',doExport);
    elC.querySelector('#g-import').addEventListener('click',doImport);
    elC.querySelector('#t-lock').addEventListener('click',lock);
    elC.querySelector('#t-chpin').addEventListener('click',function(){if(!confirm('Change PIN?'))return;SCOPE.remove('pinHash');lock();toast('PIN cleared - set a new one');});
  }

  function doExport(){if(!gL().length&&!gW().length&&!gN().length){toast('Nothing to export yet');return;}var data={_meta:{module:'Get Up To Speed',version:V,exportedAt:new Date().toISOString()},lessons:gL(),wordbank:gW(),notes:gN(),knowledge:gK()};downloadFile('guts-backup-'+new Date().toISOString().slice(0,10)+'.json',JSON.stringify(data,null,2),'application/json');toast('Export downloaded');}
  async function doImport(){var file=await pickFile('.json,application/json');if(!file)return;try{var data=JSON.parse(await file.text());if(!data.lessons)throw new Error('Invalid backup');(data.lessons||[]).forEach(function(l){sL(l);});(data.wordbank||[]).forEach(function(w){sW(w);});(data.notes||[]).forEach(function(n){sN(n);});if(data.knowledge)SCOPE.set('knowledge',data.knowledge);toast('Imported '+data.lessons.length+' lessons');renderTransfer();}catch(e){toast('Import failed: '+e.message);}}

  return{
    onShow:function(){setAI();},
    cleanup:function(){stopSpeak();lock();clearTimeout(saveTimer);}
  };
}
