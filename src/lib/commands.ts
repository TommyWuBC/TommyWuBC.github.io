// The ⌘K menu's commands, built from the content collections so new projects
// show up without editing markup. Read by src/notebook/js/chrome.js.
import { site } from '../data/site';
import { getProjects } from './content';
import { shellOf } from './shells';

export interface Command {
  group: string;
  label: string;
  href?: string;
  action?: 'copy' | 'theme' | 'fan' | 'shuffle' | 'move';
  icon: 'page' | 'go' | 'copy' | 'file' | 'theme' | 'grid' | 'ext';
  hint?: string;
  keywords?: string;
  external?: boolean;
  /** Only offered when this selector matches something on the page. */
  when?: string;
}

/** `home` = the notebook page, where section links are in-page anchors. */
export async function buildCommands(home: boolean): Promise<Command[]> {
  const at = (id: string) => (home ? `#${id}` : `/#${id}`);
  const { featured } = await getProjects();
  return [
    { group: 'Turn to', label: 'Index', href: at('index'), icon: 'page', keywords: 'contents start home' },
    { group: 'Turn to', label: 'Work', href: at('work'), icon: 'page', keywords: 'experience jobs pair saite' },
    { group: 'Turn to', label: 'Projects', href: at('projects'), icon: 'page', keywords: 'code' },
    { group: 'Turn to', label: 'Education and honors', href: at('education'), icon: 'page', keywords: 'school gpa georgia tech' },
    { group: 'Turn to', label: 'Contact', href: at('contact'), icon: 'page', keywords: 'email reach' },
    { group: 'Turn to', label: 'Photos', href: at('cover'), icon: 'page', keywords: 'pictures pile' },
    { group: 'Open', label: 'Toolbox, the skill map', href: '/toolbox/', icon: 'go', hint: 'map', keywords: 'skills stack languages tools' },
    ...featured.map((p) => {
      const shell = p.data.expansion ? shellOf(p.data.expansion) : null;
      return {
        group: 'Open',
        label: p.data.title,
        href: shell ? `/work/${p.id}/` : at(p.id),
        icon: (shell ? 'go' : 'page') as Command['icon'],
        hint: shell ? shell.noun : undefined,
        keywords: [p.data.context, ...p.data.stack].join(' ').toLowerCase(),
      };
    }),
    { group: 'Actions', label: 'Copy email address', action: 'copy', icon: 'copy', hint: site.email, keywords: 'mail contact' },
    { group: 'Actions', label: 'Open résumé', href: site.resume, icon: 'file', hint: 'PDF', keywords: 'resume cv pdf' },
    { group: 'Actions', label: 'Switch the lamp', action: 'theme', icon: 'theme', hint: 'light or dark', keywords: 'dark light mode theme' },
    { group: 'Actions', label: 'New lava layout', action: 'shuffle', icon: 'grid', keywords: 'race lava shuffle', when: '[data-lava]' },
    { group: 'Actions', label: 'Move the gaps', action: 'move', icon: 'grid', keywords: 'race lava gap', when: '[data-lava]' },
    { group: 'Actions', label: 'Spread the photos out', action: 'fan', icon: 'grid', keywords: 'photos pile shuffle', when: '#pile' },
    { group: 'Elsewhere', label: 'GitHub', href: site.github, external: true, icon: 'ext', hint: 'TommyWuBC' },
    { group: 'Elsewhere', label: 'LinkedIn', href: site.linkedin, external: true, icon: 'ext', hint: 'bingchang-wu' },
  ];
}
