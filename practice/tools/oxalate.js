const query = document.querySelector('#query');
const results = document.querySelector('#results');
const count = document.querySelector('#count');
let foods = [];
function element(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}
function search() {
  const terms = query.value.toLowerCase().trim().split(/\s+/);
  const matches = foods.filter(([name]) => terms.every(term => name.toLowerCase().includes(term)));
  count.textContent = matches.length ? matches.length + ' foods' : 'No matching food in this table. Try a shorter name or another preparation.';
  const fragment = document.createDocumentFragment();
  for (const [name, serving, grams, mg, group] of matches) {
    const row = element('article', '', 'food');
    const level = mg < 25 ? 'Low' : mg < 100 ? 'Medium' : 'High';
    const source = element('a', name);
    source.href = 'https://ohf.org/' + group + '-oxalate/';
    const heading = document.createElement('strong');
    heading.append(source);
    row.append(heading, element('span', serving + ' · ' + grams + ' g', 'serving'), element('span', mg + ' mg', 'amount'), element('span', level, 'badge ' + level.toLowerCase()));
    fragment.append(row);
  }
  results.replaceChildren(fragment);
}
fetch('foods.json').then(response => {
  if (!response.ok) throw Error('Food list unavailable');
  return response.json();
}).then(data => { foods = data; query.oninput = search; search(); })
.catch(() => { count.textContent = 'Food list unavailable. Reload or open the source tables above.'; });
