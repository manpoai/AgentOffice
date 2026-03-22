/**
 * Mention components — simplified stubs for ASuite.
 * Original Outline Mentions have deep app dependencies (stores, routing, etc.)
 * These render basic styled spans for mention tokens.
 */
import * as React from "react";
import styled from "styled-components";

type MentionBaseProps = {
  title?: string;
  children?: React.ReactNode;
  [key: string]: any;
};

const MentionSpan = styled.span`
  background: ${(p) => p.theme?.mentionBackground || "hsl(220 80% 60% / 0.15)"};
  border-radius: 4px;
  padding: 1px 4px;
  font-weight: 500;
  &:hover {
    background: ${(p) => p.theme?.mentionHoverBackground || "hsl(220 80% 60% / 0.25)"};
  }
`;

export const MentionUser = (props: MentionBaseProps) => (
  <MentionSpan>{props.title || props.children || "@user"}</MentionSpan>
);

export const MentionGroup = (props: MentionBaseProps) => (
  <MentionSpan>{props.title || props.children || "@group"}</MentionSpan>
);

export const MentionDocument = (props: MentionBaseProps) => (
  <MentionSpan>{props.title || props.children || "doc"}</MentionSpan>
);

export const MentionCollection = (props: MentionBaseProps) => (
  <MentionSpan>{props.title || props.children || "collection"}</MentionSpan>
);

export const MentionURL = (props: MentionBaseProps) => (
  <MentionSpan>{props.title || props.children || "link"}</MentionSpan>
);

export const MentionIssue = (props: MentionBaseProps) => (
  <MentionSpan>{props.title || props.children || "issue"}</MentionSpan>
);

export const MentionProject = (props: MentionBaseProps) => (
  <MentionSpan>{props.title || props.children || "project"}</MentionSpan>
);

export const MentionPullRequest = (props: MentionBaseProps) => (
  <MentionSpan>{props.title || props.children || "PR"}</MentionSpan>
);
