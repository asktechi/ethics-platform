export type SidebarLevelLink = {
  slug: string;
  name: string;
  hint: string;
};

export type SidebarClassLink = {
  id: string;
  title: string;
  meta: string;
};

export type SidebarNavData = {
  levels: SidebarLevelLink[];
  recentClasses: SidebarClassLink[];
  instructorName: string;
  instructorInitials: string;
};
