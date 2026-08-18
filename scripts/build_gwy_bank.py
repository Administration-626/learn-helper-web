import urllib.request
import json
import re
import os
import sys

def fetch_json(url, timeout=20):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode('utf-8'))

def fetch_ceval_subject(config, default_tag):
    items = []
    for split in ['val', 'dev']:
        url = f'https://datasets-server.huggingface.co/rows?dataset=ceval%2Fceval-exam&config={config}&split={split}&offset=0&limit=100'
        try:
            data = fetch_json(url)
            for r in data.get('rows', []):
                row = r.get('row', {})
                q_text = row.get('question', '').strip()
                ans = (row.get('answer', '') or '').strip().upper()
                if not q_text or not ans:
                    continue
                options = {}
                for opt in ['A', 'B', 'C', 'D']:
                    if opt in row and row[opt] is not None:
                        options[opt] = str(row[opt]).strip()
                if len(options) >= 2:
                    items.append({
                        'tag': default_tag,
                        'question': q_text,
                        'options': options,
                        'answer': ans,
                        'type': 'single',
                        'explanation': f'【科目考点】：{default_tag}\n【标准答案】：{ans}'
                    })
        except Exception as e:
            print(f'Warning: Failed fetching C-Eval {config} {split}: {e}', file=sys.stderr)
    return items

def fetch_ango_gwy(offsets=[0, 100, 200]):
    items = []
    for offset in offsets:
        url = f'https://datasets-server.huggingface.co/rows?dataset=AngoHF%2FANGO-S1&config=default&split=test&offset={offset}&limit=100'
        try:
            data = fetch_json(url)
            for r in data.get('rows', []):
                row = r.get('row', {})
                q_text = row.get('question', '').strip()
                ans = (row.get('choice', '') or '').strip().upper()
                raw_opts = row.get('options', '')
                if not q_text or not ans or not raw_opts:
                    continue
                
                options = {}
                opt_matches = re.findall(r'([A-D])[\.\:、\s]\s*([^\n\r]+)', raw_opts)
                for letter, text in opt_matches:
                    options[letter.upper()] = text.strip()
                
                if len(options) < 2:
                    continue
                
                cats = row.get('categories', [])
                tag_parts = []
                if isinstance(cats, list) and len(cats) > 0 and isinstance(cats[0], list):
                    tag_parts = [c for c in cats[0] if c]
                tag = ' / '.join(tag_parts) if tag_parts else row.get('keypoints', '判断推理')
                
                source = row.get('source', '').strip()
                year_match = re.search(r'20\d\d', source)
                year = year_match.group(0) if year_match else ''
                num_match = re.search(r'第(\d+)题', source)
                num = int(num_match.group(1)) if num_match else None
                
                explanation_parts = []
                if source:
                    explanation_parts.append(f'【真题来源】：{source}')
                explanation_parts.append(f'【考查知识点】：{tag}')
                if row.get('human_acc') is not None:
                    explanation_parts.append(f'【考生历史正确率】：{row.get("human_acc"):.1f}%')
                if row.get('most_wrong'):
                    explanation_parts.append(f'【高频易错项】：{row.get("most_wrong")}')
                
                item = {
                    'tag': tag,
                    'question': q_text,
                    'options': options,
                    'answer': ans,
                    'type': 'single',
                    'explanation': '\n'.join(explanation_parts)
                }
                if year: item['year'] = year
                if num: item['number'] = num
                items.append(item)
        except Exception as e:
            print(f'Warning: Failed fetching ANGO-S1 offset {offset}: {e}', file=sys.stderr)
    return items

def main():
    print("正在从开源数据集拉取公务员考试（行测/综合）真题数据...")
    all_questions = []

    # 1. C-Eval Civil Servant (国家公考)
    ceval_civil = fetch_ceval_subject('civil_servant', '常识与综合能力')
    print(f"✓ C-Eval 国家公考真题: {len(ceval_civil)} 题")
    all_questions.extend(ceval_civil)

    # 2. C-Eval Logic (逻辑推理)
    ceval_logic = fetch_ceval_subject('logic', '判断推理 - 逻辑推理')
    print(f"✓ C-Eval 逻辑推理专项: {len(ceval_logic)} 题")
    all_questions.extend(ceval_logic)

    # 3. ANGO-S1 (国考/各省省考真题)
    ango_questions = fetch_ango_gwy(offsets=[0, 100, 200])
    print(f"✓ ANGO-S1 历年省考/国考行测真题: {len(ango_questions)} 题")
    all_questions.extend(ango_questions)

    # Deduplicate by question text
    seen = set()
    deduped = []
    for q in all_questions:
        key = q['question'].strip()
        if key not in seen and len(key) >= 2:
            seen.add(key)
            deduped.append(q)

    # Assign sequential numbers
    for idx, q in enumerate(deduped, 1):
        if not q.get('number'):
            q['number'] = idx

    print(f"去重后总有效真题数量: {len(deduped)} 题")

    out_paths = [
        'public/banks/gwy_xingce_bank.json',
        'data/gwy_xingce_bank.json'
    ]

    for p in out_paths:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        with open(p, 'w', encoding='utf-8') as f:
            json.dump(deduped, f, ensure_ascii=False, indent=2)
        print(f"已成功导出题库至: {p}")

if __name__ == '__main__':
    main()
