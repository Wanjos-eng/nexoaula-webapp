// Generated documentary diagrams, not migrations. Run from any directory.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { createHash } = require('node:crypto');

const root = path.resolve(__dirname, '..');
const toolRequire = createRequire(path.join(root, 'tools/data-model/package.json'));
const { Parser } = toolRequire('@dbml/core');
const { instance } = toolRequire('@viz-js/viz');
const outputDirectory = path.join(root, 'docs/diagrams/generated');
const escape = value => String(value).replace(/[&<>"']/g, char =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const quote = value => JSON.stringify(value);
const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

async function main() {
  const args = process.argv.slice(2);
  if (args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/render-data-model.cjs [--check]');
  const check = args.includes('--check');
  const source = read(path.join(root, 'docs/diagrams/nexoaula.dbml')).trimEnd();
  const digest = createHash('sha256').update(source).digest('hex');
  const model = new Parser().parse(source, 'dbmlv2');
  const tables = model.schemas.flatMap(schema => schema.tables);
  const groups = model.schemas.flatMap(schema => schema.tableGroups);
  const refs = model.schemas.flatMap(schema => schema.refs);
  const tableByName = new Map(tables.map(table => [table.name, table]));
  const viz = await instance();
  const expectedFiles = new Set();
  const base = [
    'digraph model {',
    'graph [rankdir=LR, bgcolor="white", pad=0.35, nodesep=0.35, ranksep=0.9, fontname="Arial", fontsize=18, labelloc=t];',
    'node [shape=plain, fontname="Arial", fontsize=11];',
    'edge [color="#94a3b8", arrowsize=0.65, fontname="Arial", fontsize=9];'
  ];
  function save(name, lines) {
    expectedFiles.add(name);
    const svg = viz.renderString(lines.join('\n'), { format: 'svg', engine: 'dot' });
    const artifact = svg.replace('<svg ', '<svg role="img" aria-label="' + escape(name.replace('.svg', '')) + '" ')
      .replace(/<title>model<\/title>/, '<title>nexoAula — ' + escape(name.replace('.svg', '')) + '</title>')
      .replace('<svg ', '<!-- DBML SHA256: ' + digest + ' -->\n<svg ');
    const destination = path.join(outputDirectory, name);
    if (check) {
      if (!fs.existsSync(destination) || read(destination) !== artifact) {
        throw new Error('Stale or missing diagram: ' + name + '. Run node scripts/render-data-model.cjs');
      }
    } else {
      fs.mkdirSync(outputDirectory, { recursive: true });
      fs.writeFileSync(destination, artifact, 'utf8');
    }
  }
  const overview = [...base, 'label="nexoAula | módulos e referências de dados";'];
  for (const group of groups) {
    const rows = group.tables.map(table => '<TR><TD ALIGN="LEFT">' + escape(table.name) + '</TD></TR>').join('');
    overview.push(quote(group.name) + ' [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="7" COLOR="' + group.color + '"><TR><TD BGCOLOR="' + group.color + '"><FONT COLOR="white"><B>' + escape(group.name) + '</B></FONT></TD></TR>' + rows + '</TABLE>>];');
  }
  const crossModuleRefs = new Map();
  for (const ref of refs) {
    const [child, parent] = ref.endpoints;
    const from = tableByName.get(child.tableName).group.name;
    const to = tableByName.get(parent.tableName).group.name;
    if (from !== to) {
      const key = from + ':' + to;
      crossModuleRefs.set(key, (crossModuleRefs.get(key) || 0) + 1);
    }
  }
  for (const [key, count] of crossModuleRefs) {
    const [from, to] = key.split(':');
    overview.push(quote(from) + ' -> ' + quote(to) + ' [label="' + count + ' FK"];');
  }
  save('overview.svg', [...overview, '}']);

  for (const group of groups) {
    const own = new Set(group.tables.map(table => table.name));
    // Show outgoing references and their targets; inbound references appear in
    // the diagram of their source module. Do not duplicate every incoming edge.
    const moduleRefs = refs.filter(ref => own.has(ref.endpoints[0].tableName));
    const visible = new Set([...own, ...moduleRefs.map(ref => ref.endpoints[1].tableName)]);
    const lines = [...base, 'label=' + quote('nexoAula | ' + group.name + ' | origem FK → destino referenciado') + ';'];
    for (const table of tables.filter(table => visible.has(table.name))) {
      const external = !own.has(table.name);
      const visibleFields = external
        ? table.fields.filter(field => moduleRefs.some(ref => ref.endpoints[1].tableName === table.name && ref.endpoints[1].fieldNames.includes(field.name)))
        : table.fields;
      const rows = visibleFields.map(field => '<TR><TD ALIGN="LEFT">' + escape(field.name) + '</TD><TD ALIGN="LEFT">' + escape(field.type.type_name) + '</TD></TR>').join('');
      const color = external ? '#64748b' : group.color;
      lines.push(quote(table.name) + ' [label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="5" COLOR="' + color + '"><TR><TD COLSPAN="2" BGCOLOR="' + color + '"><FONT COLOR="white"><B>' + escape(table.name) + (external ? ' [externa]' : '') + '</B></FONT></TD></TR>' + rows + '</TABLE>>];');
    }
    for (const ref of moduleRefs) {
      const [child, parent] = ref.endpoints;
      const description = child.fieldNames.join(', ') + ' → ' + parent.fieldNames.join(', ') + '; DELETE ' + (ref.onDelete || 'default');
      lines.push(quote(child.tableName) + ' -> ' + quote(parent.tableName) + ' [tooltip=' + quote(description) + '];');
    }
    save(group.name + '.svg', [...lines, '}']);
  }
  const unexpected = fs.readdirSync(outputDirectory).filter(name => name.endsWith('.svg') && !expectedFiles.has(name));
  if (unexpected.length) throw new Error('Unexpected diagrams require explicit review: ' + unexpected.join(', '));
  console.log((check ? 'Verified' : 'Generated') + ' ' + expectedFiles.size + ' diagrams from ' + tables.length + ' tables / ' + refs.length + ' references. DBML SHA256: ' + digest);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
