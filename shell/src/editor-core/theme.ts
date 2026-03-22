/**
 * Outline editor theme — styled-components DefaultTheme augmentation
 * and concrete dark/light theme objects for ASuite.
 */
import "styled-components";

// Augment DefaultTheme so Styles.ts and all components see these properties
declare module "styled-components" {
  export interface DefaultTheme {
    isDark: boolean;

    // Typography
    fontFamily: string;
    fontFamilyMono: string;
    fontWeightRegular: number;

    // Core colors
    text: string;
    textSecondary: string;
    textTertiary: string;
    placeholder: string;
    background: string;
    backgroundSecondary: string;
    link: string;
    brand: { accent: string; red: string };
    accent: string;
    cursor: string;
    divider: string;
    selected: string;
    quote: string;
    slate: string;
    horizontalRule: string;

    // Code / syntax highlighting
    code: string;
    codeBackground: string;
    codeBorder: string;
    codeComment: string;
    codePunctuation: string;
    codeNumber: string;
    codeProperty: string;
    codeTag: string;
    codeString: string;
    codeSelector: string;
    codeAttrName: string;
    codeAttrValue: string;
    codeOperator: string;
    codeEntity: string;
    codeKeyword: string;
    codeFunction: string;
    codeClassName: string;
    codeStatement: string;
    codePlaceholder: string;
    codeConstant: string;
    codeParameter: string;
    codeImportant: string;

    // Notice / callout blocks
    noticeInfoText: string;
    noticeInfoBackground: string;
    noticeSuccessText: string;
    noticeSuccessBackground: string;
    noticeWarningText: string;
    noticeWarningBackground: string;
    noticeTipText: string;
    noticeTipBackground: string;

    // Table
    tableSelected: string;
    tableSelectedBackground: string;

    // Diff
    textDiffInserted: string;
    textDiffInsertedBackground: string;
    textDiffDeleted: string;
    textDiffDeletedBackground: string;

    // Mention
    mentionBackground: string;
    mentionHoverBackground: string;

    // Comment
    commentMarkBackground: string;

    // Embed
    embedBorder: string;

    // UI elements
    buttonNeutralBackground: string;
    buttonNeutralBorder: string;
    scrollbarBackground: string;
    scrollbarThumb: string;
  }
}

/** Dark theme for ASuite (default) */
export const darkTheme: import("styled-components").DefaultTheme = {
  isDark: true,

  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
  fontFamilyMono:
    'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  fontWeightRegular: 400,

  text: "hsl(0 0% 95%)",
  textSecondary: "hsl(0 0% 70%)",
  textTertiary: "hsl(0 0% 50%)",
  placeholder: "hsl(0 0% 45%)",
  background: "hsl(0 0% 9%)",
  backgroundSecondary: "hsl(0 0% 13%)",
  link: "hsl(220 80% 60%)",
  brand: { accent: "hsl(220 80% 60%)", red: "#FF5C5C" },
  accent: "hsl(220 80% 60%)",
  cursor: "hsl(0 0% 95%)",
  divider: "hsl(0 0% 20%)",
  selected: "hsl(220 80% 60%)",
  quote: "hsl(0 0% 55%)",
  slate: "hsl(0 0% 55%)",
  horizontalRule: "hsl(0 0% 20%)",

  // Code syntax — One Dark–inspired
  code: "hsl(0 0% 85%)",
  codeBackground: "hsl(0 0% 12%)",
  codeBorder: "hsl(0 0% 20%)",
  codeComment: "hsl(0 0% 45%)",
  codePunctuation: "hsl(0 0% 60%)",
  codeNumber: "hsl(29 54% 61%)",
  codeProperty: "hsl(0 70% 67%)",
  codeTag: "hsl(0 70% 67%)",
  codeString: "hsl(95 38% 62%)",
  codeSelector: "hsl(95 38% 62%)",
  codeAttrName: "hsl(29 54% 61%)",
  codeAttrValue: "hsl(95 38% 62%)",
  codeOperator: "hsl(187 47% 55%)",
  codeEntity: "hsl(207 82% 66%)",
  codeKeyword: "hsl(286 60% 67%)",
  codeFunction: "hsl(207 82% 66%)",
  codeClassName: "hsl(39 67% 69%)",
  codeStatement: "hsl(286 60% 67%)",
  codePlaceholder: "hsl(0 0% 55%)",
  codeConstant: "hsl(29 54% 61%)",
  codeParameter: "hsl(0 70% 67%)",
  codeImportant: "hsl(0 70% 67%)",

  // Notice / callout
  noticeInfoText: "hsl(210 60% 70%)",
  noticeInfoBackground: "hsl(210 60% 50% / 0.12)",
  noticeSuccessText: "hsl(142 50% 65%)",
  noticeSuccessBackground: "hsl(142 50% 45% / 0.12)",
  noticeWarningText: "hsl(38 90% 65%)",
  noticeWarningBackground: "hsl(38 90% 50% / 0.12)",
  noticeTipText: "hsl(270 50% 70%)",
  noticeTipBackground: "hsl(270 50% 55% / 0.12)",

  // Table
  tableSelected: "hsl(220 80% 60%)",
  tableSelectedBackground: "hsl(220 80% 60% / 0.15)",

  // Diff
  textDiffInserted: "hsl(142 50% 65%)",
  textDiffInsertedBackground: "hsl(142 50% 45% / 0.15)",
  textDiffDeleted: "hsl(0 65% 60%)",
  textDiffDeletedBackground: "hsl(0 65% 50% / 0.15)",

  // Mention
  mentionBackground: "hsl(220 80% 60% / 0.15)",
  mentionHoverBackground: "hsl(220 80% 60% / 0.25)",

  // Comment
  commentMarkBackground: "hsl(50 90% 60% / 0.2)",

  // Embed
  embedBorder: "hsl(0 0% 20%)",

  // UI
  buttonNeutralBackground: "hsl(0 0% 15%)",
  buttonNeutralBorder: "hsl(0 0% 25%)",
  scrollbarBackground: "transparent",
  scrollbarThumb: "hsl(0 0% 30%)",
};

/** Light theme for ASuite */
export const lightTheme: import("styled-components").DefaultTheme = {
  isDark: false,

  fontFamily: darkTheme.fontFamily,
  fontFamilyMono: darkTheme.fontFamilyMono,
  fontWeightRegular: 400,

  text: "hsl(0 0% 10%)",
  textSecondary: "hsl(0 0% 35%)",
  textTertiary: "hsl(0 0% 55%)",
  placeholder: "hsl(0 0% 60%)",
  background: "hsl(0 0% 100%)",
  backgroundSecondary: "hsl(0 0% 96%)",
  link: "hsl(220 80% 50%)",
  brand: { accent: "hsl(220 80% 50%)", red: "#FF5C5C" },
  accent: "hsl(220 80% 50%)",
  cursor: "hsl(0 0% 10%)",
  divider: "hsl(0 0% 85%)",
  selected: "hsl(220 80% 50%)",
  quote: "hsl(0 0% 45%)",
  slate: "hsl(0 0% 45%)",
  horizontalRule: "hsl(0 0% 85%)",

  code: "hsl(0 0% 25%)",
  codeBackground: "hsl(0 0% 96%)",
  codeBorder: "hsl(0 0% 85%)",
  codeComment: "hsl(0 0% 55%)",
  codePunctuation: "hsl(0 0% 40%)",
  codeNumber: "hsl(29 54% 45%)",
  codeProperty: "hsl(0 70% 50%)",
  codeTag: "hsl(0 70% 50%)",
  codeString: "hsl(95 38% 40%)",
  codeSelector: "hsl(95 38% 40%)",
  codeAttrName: "hsl(29 54% 45%)",
  codeAttrValue: "hsl(95 38% 40%)",
  codeOperator: "hsl(187 47% 40%)",
  codeEntity: "hsl(207 82% 45%)",
  codeKeyword: "hsl(286 60% 50%)",
  codeFunction: "hsl(207 82% 45%)",
  codeClassName: "hsl(39 67% 45%)",
  codeStatement: "hsl(286 60% 50%)",
  codePlaceholder: "hsl(0 0% 55%)",
  codeConstant: "hsl(29 54% 45%)",
  codeParameter: "hsl(0 70% 50%)",
  codeImportant: "hsl(0 70% 50%)",

  noticeInfoText: "hsl(210 60% 40%)",
  noticeInfoBackground: "hsl(210 60% 50% / 0.08)",
  noticeSuccessText: "hsl(142 50% 35%)",
  noticeSuccessBackground: "hsl(142 50% 45% / 0.08)",
  noticeWarningText: "hsl(38 90% 35%)",
  noticeWarningBackground: "hsl(38 90% 50% / 0.08)",
  noticeTipText: "hsl(270 50% 40%)",
  noticeTipBackground: "hsl(270 50% 55% / 0.08)",

  tableSelected: "hsl(220 80% 50%)",
  tableSelectedBackground: "hsl(220 80% 50% / 0.1)",

  textDiffInserted: "hsl(142 50% 35%)",
  textDiffInsertedBackground: "hsl(142 50% 45% / 0.1)",
  textDiffDeleted: "hsl(0 65% 45%)",
  textDiffDeletedBackground: "hsl(0 65% 50% / 0.1)",

  mentionBackground: "hsl(220 80% 50% / 0.1)",
  mentionHoverBackground: "hsl(220 80% 50% / 0.2)",

  commentMarkBackground: "hsl(50 90% 60% / 0.25)",

  embedBorder: "hsl(0 0% 85%)",

  buttonNeutralBackground: "hsl(0 0% 96%)",
  buttonNeutralBorder: "hsl(0 0% 85%)",
  scrollbarBackground: "transparent",
  scrollbarThumb: "hsl(0 0% 75%)",
};
