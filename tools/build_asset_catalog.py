"""Inspect image metadata and build an HTML catalog; never alter image pixels."""
from pathlib import Path
from PIL import Image
import json
import html

ROOT=Path(__file__).resolve().parents[1]
LABELS={
 'taibai_idle':'太白金星 · 待机','taibai_rise':'太白金星 · 上升',
 'taibai_fall':'太白金星 · 下落','taibai_hit':'太白金星 · 受击',
 'obstacle_mountain':'山峰','obstacle_stone_pillar':'石柱','obstacle_fireball':'火球',
 'obstacle_storm_cloud':'乌云','obstacle_lightning':'雷电','obstacle_wind_fire_wheel':'风火轮',
 'bg_tiangong_sky':'天空底图','bg_tiangong_far_islands':'远景仙山','bg_tiangong_mid_palace':'中景宫阙','bg_cloud_bank':'薄云',
 'ui_title_taibai':'游戏标题','ui_panel_results':'结算木牌','ui_button_primary':'主按钮',
 'ui_sound_on':'声音开启','ui_sound_off':'声音关闭','ui_hint_hold':'长按手势'}
items=[]
for path in sorted((ROOT/'assets/art').rglob('*.png')):
    with Image.open(path) as im:
        alpha=im.getchannel('A') if 'A' in im.getbands() else None
        extrema=alpha.getextrema() if alpha else [255,255]
        bbox=alpha.getbbox() if alpha else (0,0,*im.size)
        transparent=bool(alpha and extrema[0]==0)
        items.append(dict(id=path.stem,label=LABELS.get(path.stem,path.stem),
                          path=path.relative_to(ROOT).as_posix(),width=im.width,height=im.height,
                          mode=im.mode,has_transparency=transparent,alpha_extrema=extrema,
                          alpha_bounds=bbox,bytes=path.stat().st_size,
                          pivot=[.5,.5],status='v1_generated_art'))
manifest=dict(version='1.0',engine_target='Cocos Creator 3.8.8',images=items,
              audio=json.loads((ROOT/'audio_manifest.json').read_text(encoding='utf-8')))
(ROOT/'asset_manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')

groups=[('characters','角色姿态'),('obstacles','六种障碍'),('backgrounds','天宫背景'),('ui','界面素材')]
sections=[]
for folder,title in groups:
    cards=[]
    for a in items:
        if '/'+folder+'/' not in a['path']: continue
        cards.append(f'''<article class="card"><a class="imagebox" href="../{a['path']}" target="_blank"><img loading="lazy" src="../{a['path']}" alt="{a['label']}"></a><div class="caption"><strong>{a['label']}</strong><span>{a['width']} × {a['height']} · {'透明 PNG' if a['has_transparency'] else '底图 PNG'}</span><code>{a['id']}.png</code></div></article>''')
    sections.append(f'<section><h2>{title}</h2><div class="grid">'+''.join(cards)+'</div></section>')
audio=''.join(f'<article class="sound"><strong>{a["id"]}</strong><span>{a["seconds"]} 秒</span><audio controls preload="none" {"loop" if a["loop"] else ""} src="../{a["path"]}"></audio></article>' for a in manifest['audio'])
template='''<!DOCTYPE html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>太白金星不会飞 · 首版素材库</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f6f2e9;color:#21394d;font:16px/1.6 system-ui,"Microsoft YaHei",sans-serif}main{max-width:1260px;margin:auto;padding:40px 28px}header{display:flex;gap:32px;align-items:center;border-bottom:1px solid #d4d7d2;padding-bottom:32px}.intro{flex:1}h1{font-size:36px;line-height:1.3;margin:10px 0}h2{font-size:24px;margin:42px 0 20px}.tag{letter-spacing:3px;font-size:12px;color:#7a6b51}p{max-width:600px;color:#536c7d}.controls{display:flex;gap:8px;flex-wrap:wrap}button{border:1px solid #c2b79f;border-radius:8px;padding:9px 14px;background:#fff9ea;color:#21394d;cursor:pointer}button.active{background:#21394d;color:white}.scene{position:relative;flex:none;width:240px;height:420px;overflow:hidden;border-radius:18px;background:#78b9e8;box-shadow:0 10px 35px #263b4920}.scene img{position:absolute;object-fit:contain}.sky{inset:0;width:100%;height:100%!important;object-fit:cover!important}.far{width:120%;left:-10%;bottom:12%;opacity:.55}.palace{width:120%;left:-5%;bottom:0;opacity:.45}.hero{width:39%;left:12%;top:43%;animation:bob 2s ease-in-out infinite}.cloud{width:55%;left:66%;top:15%}.mountain{width:35%;left:66%;bottom:-8%}.scene-title{width:88%;left:6%;top:0}.scene small{position:absolute;bottom:8px;left:0;right:0;text-align:center;background:#fff8;font-size:10px}.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.card{border:1px solid #d7dcd7;border-radius:14px;background:#fff;overflow:hidden}.imagebox{height:230px;display:flex;align-items:center;justify-content:center;background:conic-gradient(#e6e9e5 25%,#f8faf6 0 50%,#e6e9e5 0 75%,#f8faf6 0) 0 0/24px 24px}.imagebox img{max-width:94%;max-height:94%;object-fit:contain}.caption{padding:14px 16px}.caption span,.caption code{display:block;font-size:12px;color:#6b7b83}.caption code{margin-top:5px;word-break:break-all}.sound{display:flex;gap:18px;align-items:center;flex-wrap:wrap;padding:15px 0;border-bottom:1px solid #d7dcd7}.sound strong{min-width:230px}.sound span{font-size:13px}.sound audio{height:36px;margin-left:auto}.sky-mode .imagebox{background:#78b9e8}.dark-mode .imagebox{background:#233344}.paused .hero{animation-play-state:paused}@keyframes bob{50%{transform:translateY(-9px) rotate(-3deg)}}@media(max-width:760px){header{flex-direction:column-reverse;align-items:start}h1{font-size:28px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.imagebox{height:170px}main{padding:24px 16px}.sound audio{margin-left:0}}@media(prefers-reduced-motion:reduce){.hero{animation:none}}
</style><main><header><div class="intro"><div class="tag">TIANGONG · ART COLLECTION 01</div><h1>太白金星不会飞<br>首版素材库</h1><p>白金道袍、晴空云海与天宫奇遇。这里集中展示角色姿态、障碍物、背景和界面，点击图片可查看原图。</p><p>场景组合仅用于检查素材搭配，角色动作由四张姿态图配合程序位移呈现。</p><div class="controls"><button class="active" data-mode="checker">棋盘底</button><button data-mode="sky">天空底</button><button data-mode="dark">深色底</button><button id="motion">暂停预览动效</button></div></div><div class="scene"><img class="sky" src="../assets/art/backgrounds/bg_tiangong_sky.png" alt="天空"><img class="far" src="../assets/art/backgrounds/bg_tiangong_far_islands.png" alt="远山"><img class="palace" src="../assets/art/backgrounds/bg_tiangong_mid_palace.png" alt="天宫"><img class="scene-title" src="../assets/art/ui/ui_title_taibai.png" alt="游戏标题"><img class="hero" src="../assets/art/characters/taibai/taibai_idle.png" alt="太白金星"><img class="cloud" src="../assets/art/obstacles/sky/obstacle_storm_cloud.png" alt="乌云"><img class="mountain" src="../assets/art/obstacles/ground/obstacle_mountain.png" alt="山峰"><small>素材组合示意 · 非最终游戏布局</small></div></header>
__SECTIONS__<section><h2>配乐与音效</h2><p>原创程序合成的铃音配乐与短反馈音，用于首版。配乐约 21 秒循环。</p>__AUDIO__</section><footer><p>图片使用内置 ImageGen 生成。完整提示词、透明通道与尺寸信息见项目素材清单。</p></footer></main><script>document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{document.body.classList.remove('sky-mode','dark-mode');if(b.dataset.mode!=='checker')document.body.classList.add(b.dataset.mode+'-mode');document.querySelectorAll('[data-mode]').forEach(x=>x.classList.toggle('active',x===b))});document.getElementById('motion').onclick=e=>{document.body.classList.toggle('paused');e.target.textContent=document.body.classList.contains('paused')?'播放预览动效':'暂停预览动效'};</script></html>'''
preview=ROOT/'preview'
preview.mkdir(exist_ok=True)
(preview/'index.html').write_text(template.replace('__SECTIONS__',''.join(sections)).replace('__AUDIO__',audio),encoding='utf-8')
print(json.dumps(dict(images=len(items),transparent=sum(a['has_transparency'] for a in items),total_image_mb=round(sum(a['bytes'] for a in items)/1048576,2)),ensure_ascii=False))
