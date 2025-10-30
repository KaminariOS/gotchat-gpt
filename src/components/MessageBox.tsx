// MessageBox.tsx
import React, {
  ChangeEvent,
  FormEvent,
  UIEvent,
  forwardRef,
  KeyboardEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from 'react';
import {
  IMAGE_MIME_TYPES,
  MAX_IMAGE_ATTACHMENTS_PER_MESSAGE,
  MAX_ROWS,
  SNIPPET_MARKERS,
  TEXT_MIME_TYPES
} from '../constants/appConstants';
import {SubmitButton} from "./SubmitButton";
import {useTranslation} from 'react-i18next';
import {ChatService} from "../service/ChatService";
import {PaperClipIcon, StopCircleIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon} from "@heroicons/react/24/outline";
import Tooltip from "./Tooltip";
import FileDataPreview from './FileDataPreview';
import {FileDataRef} from '../models/FileData';
import {preprocessImage} from '../utils/ImageUtils';
import MarkdownBlock from './MarkdownBlock';

interface MessageBoxProps {
  callApp: Function;
  loading: boolean;
  setLoading: (loading: boolean) => void;
  allowImageAttachment: string;
}

// Methods exposed to clients using useRef<MessageBoxHandles>
export interface MessageBoxHandles {
  clearInputValue: () => void;
  getTextValue: () => string;
  reset: () => void;
  resizeTextArea: () => void;
  focusTextarea: () => void;
  pasteText: (text: string) => void;
}

const MessageBox =
  forwardRef<MessageBoxHandles, MessageBoxProps>(
    ({loading, setLoading, callApp, allowImageAttachment}, ref) => {
      const {t} = useTranslation();
      const textValue = useRef('');
      const [isTextEmpty, setIsTextEmpty] = useState(true);
      const textAreaRef = useRef<HTMLTextAreaElement>(null);
      const resizeTimeoutRef = useRef<number | null>(null);
      const selectionRef = useRef<{ start: number; end: number }>({start: 0, end: 0});
      const [fileDataRef, setFileDataRef] = useState<FileDataRef[]>([]);
      const [isExpanded, setIsExpanded] = useState(false);
      const [expandedScrollOffset, setExpandedScrollOffset] = useState(0);
      const [draftText, setDraftText] = useState('');
      const attachmentsLabel = t('attachments', {defaultValue: 'Attachments'});
      const editorLabel = t('editor', {defaultValue: 'Editor'});
      const previewLabel = t('preview', {defaultValue: 'Preview'});
      const expandLabel = t('expand', {defaultValue: 'Expand'});
      const collapseLabel = t('collapse', {defaultValue: 'Collapse'});
      const isMacPlatform = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const shortcutLabel = isMacPlatform ? '⌘⇧E' : 'Ctrl+Shift+E';

      const focusComposer = useCallback(() => {
        setTimeout(() => {
          if (textAreaRef.current) {
            textAreaRef.current.focus();
            textAreaRef.current.selectionStart = selectionRef.current.start;
            textAreaRef.current.selectionEnd = selectionRef.current.end;
          }
        }, 0);
      }, []);

      const setTextValue = (value: string) => {
        textValue.current = value;
      }

      const setTextAreaValue = (value: string) => {
        setDraftText(value);
        setTextValue(value);
        setIsTextEmpty(value.trim() === '');
        if (textAreaRef.current) {
          textAreaRef.current.value = value;
        }
        selectionRef.current = {start: value.length, end: value.length};
        debouncedResize();
      }

      useImperativeHandle(ref, () => ({
        // Method to clear the textarea
        clearInputValue: () => {
          clearValueAndUndoHistory(textAreaRef);
        },
        getTextValue: () => {
          return textValue.current;
        },
        reset: () => {
          clearValueAndUndoHistory(textAreaRef);
          setTextValue('');
          setTextAreaValue('');
          setFileDataRef([]);
        },
        resizeTextArea: () => {
          if (textAreaRef.current) {
            textAreaRef.current.style.height = 'auto';
          }
        },
        focusTextarea: () => {
          focusComposer();
        },
        pasteText: (text: string) => {
          insertTextAtCursorPosition(text);
        },
      }));

      // Function to handle auto-resizing of the textarea
      const handleAutoResize = useCallback(() => {
        if (textAreaRef.current) {
          const target = textAreaRef.current;
          if (isExpanded) {
            target.style.height = '100%';
            return;
          }
          const maxHeight = parseInt(getComputedStyle(target).lineHeight || '0', 10) * MAX_ROWS;

          target.style.height = 'auto';
          if (target.scrollHeight <= maxHeight) {
            target.style.height = `${target.scrollHeight}px`;
          } else {
            target.style.height = `${maxHeight}px`;
          }
        }
      }, [isExpanded]);

      // Debounced resize function
      const debouncedResize = useCallback(() => {
        if (resizeTimeoutRef.current !== null) {
          clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = window.setTimeout(() => {
          handleAutoResize();
        }, 100);
      }, [handleAutoResize]);

      const handleTextValueUpdated = () => {
        debouncedResize();

        // After resizing, scroll the textarea to the insertion point (end of the pasted text).
        if (textAreaRef.current) {
          const textarea = textAreaRef.current;
          // Check if the pasted content goes beyond the max height (overflow scenario)
          if (textarea.scrollHeight > textarea.clientHeight) {
            // Scroll to the bottom of the textarea
            textarea.scrollTop = textarea.scrollHeight;
          }
        }
      };

      function clearValueAndUndoHistory(textAreaRef: React.RefObject<HTMLTextAreaElement | null>) {
        setFileDataRef([]);
        setTextValue('');
        setTextAreaValue('');
        setDraftText('');
        selectionRef.current = {start: 0, end: 0};
      }

      const insertTextAtCursorPosition = (textToInsert: string) => {
        if (textAreaRef.current) {
          const textArea = textAreaRef.current;
          const startPos = textArea.selectionStart || 0;
          const endPos = textArea.selectionEnd || 0;
          const text = textArea.value;
          const newTextValue =
            text.substring(0, startPos) +
            textToInsert +
            text.substring(endPos);

          // Update the state with the new value
          setTextValue(newTextValue);
          setTextAreaValue(newTextValue);
          selectionRef.current = {start: startPos + textToInsert.length, end: startPos + textToInsert.length};

          // Dispatch a new InputEvent for the insertion of text
          // This event should be undoable
          // const inputEvent = new InputEvent('input', {
          //   bubbles: true,
          //   cancelable: true,
          //   inputType: 'insertText',
          //   data: textToInsert,
          // });
          // textArea.dispatchEvent(inputEvent);

          // Move the cursor to the end of the inserted text
          const newCursorPos = startPos + textToInsert.length;
          setTimeout(() => {
            textArea.selectionStart = newCursorPos;
            textArea.selectionEnd = newCursorPos;
            // Scroll to the insertion point after the DOM update
            if (textArea.scrollHeight > textArea.clientHeight) {
              textArea.scrollTop = textArea.scrollHeight;
            }
          }, 0);
        }
      };

      const handlePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {

        if (event.clipboardData && event.clipboardData.items) {
          const items = event.clipboardData.items;

          for (const item of items) {
            if (item.type.indexOf("image") === 0 && allowImageAttachment !== 'no') {
              event.preventDefault();
              const file = item.getAsFile();
              if (file) {
                const reader = new FileReader();
                reader.onload = (loadEvent) => {
                  if (loadEvent.target !== null) {
                    const base64Data = loadEvent.target.result;

                    if (typeof base64Data === 'string') {
                      preprocessImage(file, (base64Data, processedFile) => {
                        setFileDataRef((prevData) => [...prevData, {
                          id: 0,
                          fileData: {
                            data: base64Data,
                            type: processedFile.type,
                            source: 'pasted',
                            filename: 'pasted-image',
                          }
                        }]);
                      });
                      if (allowImageAttachment == 'warn') {
                        // todo: could warn user
                      }
                    }
                  }
                };
                reader.readAsDataURL(file);
              }
            } else {

            }
          }
        }

        // Get the pasted text from the clipboard
        const pastedText = event.clipboardData.getData('text/plain');


        // Check if the pasted text contains the snippet markers
        const containsBeginMarker = pastedText.includes(SNIPPET_MARKERS.begin);
        const containsEndMarker = pastedText.includes(SNIPPET_MARKERS.end);

        // If either marker is found, just allow the default paste behavior
        if (containsBeginMarker || containsEndMarker) {
          return; // Early return if markers are present
        }

        // Count the number of newlines in the pasted text
        const newlineCount = (pastedText.match(/\n/g) || []).length;

        // Check if there are MAX_ROWS or more newlines
        if (newlineCount >= MAX_ROWS || pastedText.length > 80 * MAX_ROWS) {
          event.preventDefault();
          const modifiedText = `${SNIPPET_MARKERS.begin}\n${pastedText}\n${SNIPPET_MARKERS.end}\n`;
          insertTextAtCursorPosition(modifiedText);
        } else {
          // Allow the default paste behavior to occur
          // The textarea value will be updated automatically
        }
      };

      const checkForSpecialKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
        const isEnter = (e.key === 'Enter');

        if (isEnter) {
          if (e.shiftKey) {
            return;
          } else {
            if (!loading) {
              e.preventDefault();
              if (e.currentTarget) {
                selectionRef.current = {
                  start: e.currentTarget.selectionStart || 0,
                  end: e.currentTarget.selectionEnd || 0,
                };
              }
              const messageText = draftText;
              setTextValue(messageText);
              callApp(messageText, (allowImageAttachment === 'yes') ? fileDataRef : []);
              setTextAreaValue('');
              setIsExpanded(false);
              selectionRef.current = {start: 0, end: 0};
              focusComposer();
            }
          }
        }
      };

      const handleTextChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = event.target.value;
        selectionRef.current = {start: event.target.selectionStart || 0, end: event.target.selectionEnd || 0};
        setIsTextEmpty(newValue.trim() === '');
        setDraftText(newValue);
        setTextValue(newValue);
        handleTextValueUpdated();
      };

      const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const messageText = draftText;
        setTextValue(messageText);
        callApp(messageText, (allowImageAttachment === 'yes') ? fileDataRef : []);
        setTextAreaValue('');
        setIsExpanded(false);
        selectionRef.current = {start: 0, end: 0};
        focusComposer();
      };
      const handleCancel = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        ChatService.cancelStream();
        setLoading(false);
      };


      const handleAttachment = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        // Create an input element of type file
        const fileInput = document.createElement('input');
        fileInput.setAttribute('type', 'file');
        fileInput.setAttribute('multiple', '');
        const acceptedMimeTypes = ((allowImageAttachment !== 'no') ? IMAGE_MIME_TYPES : []).concat(TEXT_MIME_TYPES).join(',');
        fileInput.setAttribute('accept', acceptedMimeTypes);
        fileInput.click();

        // Event listener for file selection
        fileInput.onchange = (e) => {
          const files = fileInput.files;
          if (files) {
            Array.from(files).forEach((file) => {
              // Check if the file is an image
              if (file.type.startsWith('image/')) {
                if (fileDataRef.length >= MAX_IMAGE_ATTACHMENTS_PER_MESSAGE) {
                  return;
                }
                preprocessImage(file, (base64Data, processedFile) => {
                  setFileDataRef((prev) => [...prev, {
                    id: 0,
                    fileData: {
                      data: base64Data,
                      type: processedFile.type,
                      source: 'filename',
                      filename: processedFile.name,
                    }
                  }]);
                  if (allowImageAttachment == 'warn') {
                    // todo: could warn user
                  }
                });
              }
              // Else, if the file is a text file
              else if (file.type.startsWith('text/')) {
                const reader = new FileReader();

                reader.onloadend = () => {
                  const textContent = reader.result as string;
                  const formattedText = `File: ${file.name}:\n${SNIPPET_MARKERS.begin}\n${textContent}\n${SNIPPET_MARKERS.end}\n`;
                  insertTextAtCursorPosition(formattedText);
                  if (textAreaRef.current) {
                    selectionRef.current = {
                      start: textAreaRef.current.selectionStart || 0,
                      end: textAreaRef.current.selectionEnd || 0,
                    };
                  }

                  // Focus the textarea and place the cursor at the end of the text
                  if (textAreaRef.current) {
                    const textArea = textAreaRef.current;
                    textArea.focus();

                    const newCursorPos = textArea.value.length;

                    // Use setTimeout to ensure the operation happens in the next tick after render reflow
                    setTimeout(() => {
                      textArea.selectionStart = newCursorPos;
                      textArea.selectionEnd = newCursorPos;
                      handleAutoResize();
                      textArea.scrollTop = textArea.scrollHeight;
                    }, 0);
                  }
                };

                reader.onerror = (errorEvent) => {
                  console.error("File reading error:", errorEvent.target?.error);
                };

                reader.readAsText(file);
              }
            });
          }
        };
      };


      const handleRemoveFileData = (index: number, fileRef: FileDataRef) => {
        setFileDataRef(fileDataRef.filter((_, i) => i !== index));
      };

      const handleExpandEditor = () => {
        if (textAreaRef.current) {
          selectionRef.current = {
            start: textAreaRef.current.selectionStart || 0,
            end: textAreaRef.current.selectionEnd || 0,
          };
        }
        setExpandedScrollOffset(0);
        setIsExpanded(true);
      };

      const handleCollapseEditor = () => {
        if (textAreaRef.current) {
          selectionRef.current = {
            start: textAreaRef.current.selectionStart || 0,
            end: textAreaRef.current.selectionEnd || 0,
          };
        }
        setExpandedScrollOffset(0);
        setIsExpanded(false);
        focusComposer();
      };

      useEffect(() => {
        if (isExpanded) {
          const previousOverflow = document.body.style.overflow;
          document.body.style.overflow = 'hidden';
          setTimeout(() => {
            textAreaRef.current?.focus();
            if (textAreaRef.current) {
              textAreaRef.current.selectionStart = selectionRef.current.start;
              textAreaRef.current.selectionEnd = selectionRef.current.end;
            }
          }, 0);
          return () => {
            document.body.style.overflow = previousOverflow;
          };
        } else {
          if (textAreaRef.current) {
            textAreaRef.current.style.height = 'auto';
            textAreaRef.current.selectionStart = selectionRef.current.start;
            textAreaRef.current.selectionEnd = selectionRef.current.end;
          }
          focusComposer();
        }
      }, [focusComposer, isExpanded]);

      useEffect(() => {
        if (typeof window === 'undefined') {
          return;
        }

        const handleGlobalShortcut = (event: globalThis.KeyboardEvent) => {
          const key = event.key?.toLowerCase();
          const modifierPressed = isMacPlatform ? event.metaKey : event.ctrlKey;
          if (modifierPressed && event.shiftKey && key === 'e') {
            event.preventDefault();
            if (isExpanded) {
              handleCollapseEditor();
            } else {
              handleExpandEditor();
            }
          }
        };

        window.addEventListener('keydown', handleGlobalShortcut);
        return () => {
          window.removeEventListener('keydown', handleGlobalShortcut);
        };
      }, [handleCollapseEditor, handleExpandEditor, isExpanded, isMacPlatform]);

      const renderAttachmentButton = () => (
        <button
          type="button"
          onClick={(e) => handleAttachment(e)}
          className="p-1 relative z-10 flex items-center gap-1 text-sm hover:text-emerald-600"
        >
          <PaperClipIcon className="h-6 w-6"/>
          <span className="hidden sm:inline">{attachmentsLabel}</span>
        </button>
      );

      const renderStopOrSubmit = (buttonClass?: string) => (
        <div className={`flex items-center justify-end ${buttonClass ?? ''}`}>
          {loading ? (
            <Tooltip title={t('cancel-output')} side="top" sideOffset={0}>
              <button
                type="button"
                onClick={(e) => handleCancel(e)}
                className="p-1">
                <StopCircleIcon className="h-6 w-6"/>
              </button>
            </Tooltip>
          ) : (
            <SubmitButton
              disabled={isTextEmpty || loading}
              loading={loading}
            />
          )}
        </div>
      );

      const renderFilePreview = (className?: string) => (
        fileDataRef.length > 0 && (
          <div className={className ?? 'w-full'}>
            <FileDataPreview fileDataRef={fileDataRef} removeFileData={handleRemoveFileData}
                             allowImageAttachment={allowImageAttachment == 'yes'}/>
          </div>
        )
      );

      const collapsedTextarea = (
        <textarea
          id="sendMessageInput"
          name="message"
          tabIndex={0}
          ref={textAreaRef}
          rows={1}
          className="flex-auto m-0 resize-none border-0 bg-transparent px-2 py-2 focus:ring-0 focus-visible:ring-0 outline-hidden shadow-none dark:bg-transparent"
          placeholder={t('send-a-message')}
          onKeyDown={checkForSpecialKey}
          onChange={handleTextChange}
          onPaste={handlePaste}
          style={{ minWidth: 0 }}
          value={draftText}
        ></textarea>
      );

      const lineCount = useMemo(() => {
        if (!draftText) {
          return 1;
        }
        return draftText.split(/\r\n|\r|\n/).length;
      }, [draftText]);

      const lineNumberColumnWidth = useMemo(() => {
        const digits = Math.max(String(lineCount).length, 2);
        return `calc(${digits}ch + 1.5rem)`;
      }, [lineCount]);

      const handleExpandedScroll = useCallback((event: UIEvent<HTMLTextAreaElement>) => {
        setExpandedScrollOffset(event.currentTarget.scrollTop);
      }, []);

      const expandedEditor = (
        <div className="flex h-full w-full">
          <div
            aria-hidden="true"
            className="relative flex-none border-r border-black/10 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/40"
            style={{width: lineNumberColumnWidth}}
          >
            <div
              className="pointer-events-none select-none px-3 py-3 text-right text-xs font-mono leading-6 text-gray-400 dark:text-gray-500"
              style={{transform: `translateY(-${expandedScrollOffset}px)`}}
            >
              {Array.from({length: lineCount}, (_, index) => (
                <div key={index} className="tabular-nums">
                  {index + 1}
                </div>
              ))}
            </div>
          </div>
          <textarea
            id="sendMessageInput"
            name="message"
            ref={textAreaRef}
            tabIndex={0}
            className="h-full w-full flex-1 resize-none border-0 bg-transparent px-3 py-3 font-sans text-base leading-6 focus:ring-0 focus-visible:ring-0 outline-hidden shadow-none dark:bg-transparent"
            placeholder={t('send-a-message')}
            onKeyDown={checkForSpecialKey}
            onChange={handleTextChange}
            onPaste={handlePaste}
            onScroll={handleExpandedScroll}
            style={{minHeight: 0}}
            value={draftText}
          ></textarea>
        </div>
      );

      const previewPane = (
        <div className="flex-1 overflow-auto p-4 bg-gray-50 dark:bg-gray-900/40">
          <div className="markdown prose max-w-none break-words dark:prose-invert light">
            <MarkdownBlock markdown={draftText} role="user" loading={false}/>
          </div>
        </div>
      );

      if (isExpanded) {
        return (
          <div className="fixed inset-0 z-50 flex flex-col bg-black/50">
            <form onSubmit={handleSubmit} className="flex flex-col flex-1 bg-white dark:bg-gray-900">
              <div className="flex items-center justify-between border-b border-black/10 dark:border-gray-800 px-4 py-3">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('send-a-message')}</span>
                <div className="flex items-center gap-2">
                  <Tooltip title={`${collapseLabel} (${shortcutLabel})`} side="top" sideOffset={6}>
                    <button
                      type="button"
                      onClick={handleCollapseEditor}
                      className="flex items-center gap-1 rounded-md border border-black/10 dark:border-gray-700 px-3 py-1 text-sm text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <ArrowsPointingInIcon className="h-4 w-4"/>
                      {collapseLabel}
                    </button>
                  </Tooltip>
                </div>
              </div>
              {renderFilePreview('border-b border-black/10 dark:border-gray-800')}
              <div className="flex flex-1 flex-col md:flex-row overflow-hidden">
                <div className="flex flex-1 flex-col overflow-hidden md:border-r md:border-black/10 md:dark:border-gray-800">
                  <div className="flex items-center justify-between border-b border-black/10 dark:border-gray-800 px-4 py-2">
                    <div className="flex items-center gap-2">
                      {renderAttachmentButton()}
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{editorLabel}</span>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    {expandedEditor}
                  </div>
                </div>
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex items-center justify-between border-b border-black/10 dark:border-gray-800 px-4 py-2">
                    <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{previewLabel}</span>
                  </div>
                  {previewPane}
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-black/10 dark:border-gray-800 px-4 py-3">
                <div className="flex items-center gap-2">
                  {renderAttachmentButton()}
                </div>
                {renderStopOrSubmit()}
              </div>
            </form>
          </div>
        );
      }

      return (
        <div
          style={{position: "sticky"}}
          className="absolute bottom-0 left-0 w-full border-t md:border-t-0 dark:border-white/20 md:border-transparent md:dark:border-transparent bg-white dark:bg-gray-900 md:bg-transparent! pt-2">
          <form onSubmit={handleSubmit}
                className="stretch mx-2 flex flex-row gap-3 last:mb-2 md:mx-4 md:last:mb-6 lg:mx-auto md:max-w-2xl lg:max-w-3xl xl:max-w-4xl 2xl:max-w-5xl 3xl:max-w-6xl 4xl:max-w7xl">
            <div id="message-box-border"
                 style={{borderRadius: "1rem"}}
                 className="relative flex flex-col h-full flex-1 w-full py-2 grow md:py-3 bg-white dark:bg-gray-850
               dark:text-white dark:bg-gray-850 border border-black/10 dark:border-gray-900/50
               focus-within:border-black/30 dark:focus-within:border-gray-500/50"
            >
              {/* FileDataPreview Full Width at the Top */}
              {fileDataRef.length > 0 && (
                <div className="w-full">
                  <FileDataPreview fileDataRef={fileDataRef} removeFileData={handleRemoveFileData}
                                   allowImageAttachment={allowImageAttachment == 'yes'}/>
                </div>
              )}
              {/* Container for Textarea and Buttons */}
              <div className="flex items-center w-full relative space-x-2">
                {/* Attachment Button */}
                <div className="flex items-center justify-start">
                  {renderAttachmentButton()}
                </div>
                <div className="flex items-center">
                  <Tooltip title={`${expandLabel} (${shortcutLabel})`} side="top" sideOffset={4}>
                    <button
                      type="button"
                      onClick={handleExpandEditor}
                      className="flex items-center gap-1 rounded-md border border-black/10 dark:border-gray-700 px-2 py-1 text-xs text-gray-600 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <ArrowsPointingOutIcon className="h-4 w-4"/>
                      {expandLabel}
                    </button>
                  </Tooltip>
                </div>

                {/* Grammarly extension container */}
                <div className="flex items-center " style={{ flexShrink: 0, minWidth: 'fit-content' }}>
                  {/* Grammarly extension buttons will render here without overlapping */}
                </div>

                {/* Textarea */}
                {collapsedTextarea}

                {/* Cancel/Submit Button */}
                {renderStopOrSubmit()}
              </div>
            </div>
          </form>
        </div>
      );
    });

export default MessageBox;
