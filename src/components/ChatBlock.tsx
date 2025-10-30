import React, {ChangeEvent, KeyboardEvent, useContext, useEffect, useRef, useState} from 'react';
import {SparklesIcon, UserCircleIcon} from "@heroicons/react/24/outline";
import MarkdownBlock from './MarkdownBlock';
import CopyButton, {CopyButtonMode} from "./CopyButton";
import {ChatMessage, MessageType} from "../models/ChatCompletion";
import UserContentBlock from "./UserContentBlock";
import { UserContext } from "../UserContext";
import TextToSpeechButton from "./TextToSpeechButton";

interface Props {
  block: ChatMessage;
  loading: boolean;
  isLastBlock: boolean;
}

const ChatBlock: React.FC<Props> = ({block, loading, isLastBlock}) => {
  const [isEdit, setIsEdit] = useState(false);
  const [editedBlockContent, setEditedBlockContent] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [savedHeight, setSavedHeight] = useState<string | null>(null);
  const { userSettings } = useContext(UserContext);
  const isUser = block.role === 'user';
  const isAssistant = block.role === 'assistant';

  const errorStyles = block.messageType === MessageType.Error ? {
    backgroundColor: userSettings.theme === 'dark' ? 'rgb(50, 36, 36)' : '#F5E6E6',
    borderColor: 'red',
    borderWidth: '1px',
    borderRadius: '8px',
    padding: '10px'
  } : {};


  useEffect(() => {
    if (isEdit) {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(0, 0);
    }
  }, [isEdit]);


  const handleRegenerate = () => {
  }

  const handleEdit = () => {
    if (contentRef.current) {
      setSavedHeight(`${contentRef.current.offsetHeight}px`);
    }
    setIsEdit(true);
    setEditedBlockContent(block.content);
  }
  const handleEditSave = () => {
    // todo: notify main to change content block
    setIsEdit(false);
  }

  const handleEditCancel = () => {
    setIsEdit(false);
  }

  const checkForSpecialKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    const isEnter = (e.key === 'Enter');
    const isEscape = (e.key === 'Escape');

    if (isEnter) {
      e.preventDefault();
      handleEditSave();
    } else if (isEscape) {
      e.preventDefault();
      handleEditCancel();
    }
  };

  const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setEditedBlockContent(event.target.value);
  };

  return (
      <div key={`chat-block-${block.id}`}
           className={`group w-full text-gray-800 dark:text-gray-100 border-b border-black/10 dark:border-gray-900/50
            ${isAssistant ? 'bg-custom-gray dark:bg-gray-900' : 'bg-white dark:bg-gray-850'}`}>
        <div
            className="text-base md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl 3xl:max-w-6xl 4xl:max-w7xl p-2 flex lg:px-0 m-auto flex-col">
          <div className={`w-full flex ${isUser ? 'flex-row-reverse' : ''}`}>
            <div className={`w-[30px] flex flex-col relative ${isUser ? 'items-start ml-4' : 'items-end mr-4'}`}>
              <div className={`relative flex h-[30px] w-[30px] p-0 rounded-full items-center justify-center
               ${isUser ? 'bg-emerald-500 text-white shadow-sm' : ''}`}>
                {isUser ? (
                    <UserCircleIcon width={20} height={20}/>
                ) : isAssistant ? (
                    <SparklesIcon key={`open-ai-logo-${block.id}`}/>
                ) : null}
              </div>
            </div>
            <div className={`relative flex w-[calc(100%-50px)] flex-col gap-1 md:gap-3 lg:w-full ${isUser ? 'items-end text-right' : ''}`}>
              <div id={`message-block-${block.id}`} className="flex grow flex-col gap-3"
                   style={errorStyles}>
                <div
                    className={`min-h-[20px] flex flex-col gap-4 ${isUser ? 'items-end' : 'items-start'}`}>
                  {isEdit ? (
                          <textarea
                              spellCheck={false}
                              tabIndex={0}
                              ref={textareaRef}
                              style={{height: savedHeight ?? undefined, lineHeight: '1.33', fontSize: '1rem'}}
                              className="border border-black/10 bg-white dark:border-gray-900/50 dark:bg-gray-700 w-full m-0 p-0 pr-7 pl-2 md:pl-0 resize-none bg-transparent dark:bg-transparent  focus:ring-0 focus-visible:ring-0 outline-hidden shadow-none"
                              onChange={handleTextChange}
                              onKeyDown={checkForSpecialKey}
                              value={editedBlockContent}
                          ></textarea>
                      )
                      : (isUser ? (
                          <div ref={contentRef} className="self-end">
                            <div
                                className="inline-block max-w-[85%] md:max-w-[70%] rounded-3xl px-4 py-2 shadow-sm text-left bg-emerald-500 text-white">
                              <UserContentBlock text={block.content}
                                                fileDataRef={(block.fileDataRef) ? block.fileDataRef : []}/>
                            </div>
                          </div>
                      ) : (
                          <div ref={contentRef}
                               className="markdown prose w-full break-words dark:prose-invert light">
                            <MarkdownBlock markdown={block.content} role={block.role}
                                               loading={loading}/>
                          </div>
                      ))}

                </div>
              </div>
            </div>
          </div>
          {!(isLastBlock && loading) && (
              <div id={`action-block-${block.id}`}
                   className={`flex items-center ${isUser ? 'justify-end mr-10' : 'justify-start ml-10'}`}>
                {isAssistant && (
                    <TextToSpeechButton content={block.content}/>
                )}
                <div className="copy-button">
                  <CopyButton mode={CopyButtonMode.Compact} text={block.content}/>
                </div>
                {/*          {block.role === 'assistant' && (
                    <div className="regenerate-button text-gray-400 visible">
                        <button className="flex gap-2" onClick={handleRegenerate}>
                            <ArrowPathRoundedSquareIcon {...iconProps}/>
                        </button>
                    </div>
                  )}
                  <div className="regenerate-button text-gray-400 visible">
                      <button className="flex gap-2" onClick={handleEdit}>
                          <PencilSquareIcon {...iconProps}/>
                      </button>
                  </div>*/}
              </div>
          )}
        </div>
      </div>
  );
};

export default ChatBlock;
