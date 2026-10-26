const fs = require('fs');
const files = [
  'apps/web/src/app/tasks/page.tsx',
  'apps/web/src/app/team/page.tsx',
  'apps/web/src/app/project-management/page.tsx',
  'apps/web/src/app/sprint/page.tsx',
  'apps/web/src/app/dashboard/page.tsx',
  'apps/web/src/app/bug-tracking/page.tsx',
  'apps/web/src/app/asset-library/page.tsx',
];

for (const f of files) {
  let content = fs.readFileSync(f, 'utf-8');
  
  if (!content.includes('import { Sidebar }')) {
    content = content.replace(/(import .*?\n)/, '$1import { Sidebar } from "@/components/sidebar";\n');
  }

  content = content.replace(/function Sidebar\(/g, 'function LocalSidebar_Unused(');
  fs.writeFileSync(f, content);
}
