import React, { type JSX } from 'react';
import {SNIPPET_MARKERS} from "../constants/appConstants";
import FoldableTextSection from './FoldableTextSection';
import { FileDataRef } from '../models/FileData';
import FileDataPreview from './FileDataPreview';
import MarkdownBlock from './MarkdownBlock';

interface UserContentBlockProps {
  text: string;
  fileDataRef: FileDataRef[];
}

const UserContentBlock: React.FC<UserContentBlockProps> = ({text, fileDataRef}) => {
  const renderMarkdownSection = (content: string, key: string): JSX.Element => {
    if (!content) {
      return <React.Fragment key={key}></React.Fragment>;
    }

    return (
      <div
        key={key}
        className="markdown prose w-full break-words dark:prose-invert light"
      >
        <MarkdownBlock markdown={content} role="user" loading={false}/>
      </div>
    );
  };

  const processText = (inputText: string): JSX.Element[] => {
    const sections: JSX.Element[] = [];
    inputText.split(SNIPPET_MARKERS.begin).forEach((section, index) => {
      if (index === 0 && !section.includes(SNIPPET_MARKERS.end)) {
        sections.push(renderMarkdownSection(section, `text-${index}`));
        return;
      }

      const endSnippetIndex = section.indexOf(SNIPPET_MARKERS.end);
      if (endSnippetIndex !== -1) {
        const snippet = section.substring(0, endSnippetIndex);
        sections.push(
            <FoldableTextSection key={`foldable-${index}`} content={snippet}/>
        );

        const remainingText = section.substring(endSnippetIndex + SNIPPET_MARKERS.end.length);
        if (remainingText) {
          sections.push(renderMarkdownSection(remainingText, `text-after-${index}`));
        }
      } else {
        sections.push(renderMarkdownSection(section, `text-start-${index}`));
      }
    });

    return sections;
  };

  const content = processText(text);

  return (
    <div>
      {fileDataRef && fileDataRef.length > 0 &&
        <FileDataPreview fileDataRef={fileDataRef} readOnly={true} />}
      <div>{content}</div>
    </div>
  );
};

export default UserContentBlock;
