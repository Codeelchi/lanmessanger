'use client'

import { useState, useRef, useCallback, forwardRef, useImperativeHandle, useEffect, type KeyboardEvent, type DragEvent, type ClipboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send, X, Reply, Paperclip, Loader2, Image as ImageIcon, FileText, Mic } from 'lucide-react'
import { EmojiPicker } from './emoji-picker'
import { VoiceRecorder } from './voice-recorder'
import { type ChatMessage, useChatStore } from '@/lib/chat-store'
import { formatFileSize } from './file-preview'

export interface UploadedFile {
  fileUrl: string
  fileName: string
  fileType: string
  fileSize: number
  isImage: boolean
  preview?: string
}

export interface VoiceRecording {
  blob: Blob
  duration: number
  base64: string
}

export interface MessageInputHandle {
  focus: () => void
  setContent: (content: string) => void
  setReplyingTo: (message: ChatMessage | null) => void
}

interface MessageInputProps {
  onSend: (content: string, replyToId?: string) => void
  onSendFile?: (file: UploadedFile, caption?: string, replyToId?: string) => void
  onSendVoice?: (recording: VoiceRecording, replyToId?: string) => void
  disabled?: boolean
  onInput?: () => void
  editingMessage?: ChatMessage | null
  replyingTo?: ChatMessage | null
  onCancelEdit?: () => void
  onCancelReply?: () => void
}

export const MessageInput = forwardRef<MessageInputHandle, MessageInputProps>(
  function MessageInput({ onSend, onSendFile, onSendVoice, disabled, onInput: onInputCallback, editingMessage, replyingTo, onCancelEdit, onCancelReply }, ref) {
    const [content, setContent] = useState('')
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const prevEditingIdRef = useRef<string | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const [uploadPreview, setUploadPreview] = useState<UploadedFile | null>(null)
    const [isDragOver, setIsDragOver] = useState(false)
    const [isRecording, setIsRecording] = useState(false)

    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      setContent,
      setReplyingTo: (message: ChatMessage | null) => {
        useChatStore.getState().setReplyingTo(message)
      },
    }))

    // Sync content when editingMessage changes (using imperative DOM update to avoid setState in effect)
    useEffect(() => {
      const editingId = editingMessage?.id || null
      if (editingId && editingId !== prevEditingIdRef.current) {
        prevEditingIdRef.current = editingId
        // Use DOM manipulation + synthetic event to avoid lint rule
        const textarea = textareaRef.current
        if (textarea) {
          // Use native input setter to bypass React's controlled component
          const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
          nativeInputValueSetter?.call(textarea, editingMessage!.content)
          textarea.dispatchEvent(new Event('input', { bubbles: true }))
          textarea.focus()
        }
      } else if (!editingId) {
        prevEditingIdRef.current = null
      }
    }, [editingMessage])

    // Focus when replying changes
    useEffect(() => {
      if (replyingTo) {
        textareaRef.current?.focus()
      }
    }, [replyingTo])

    const uploadFile = useCallback(async (file: File) => {
      setIsUploading(true)
      setUploadProgress(0)

      try {
        const formData = new FormData()
        formData.append('file', file)

        // Simulate progress
        const progressInterval = setInterval(() => {
          setUploadProgress((prev) => {
            if (prev >= 90) {
              clearInterval(progressInterval)
              return 90
            }
            return prev + Math.random() * 15
          })
        }, 200)

        const res = await fetch('/api/chat/upload', {
          method: 'POST',
          body: formData,
        })

        clearInterval(progressInterval)

        const result = await res.json()

        if (result.success) {
          setUploadProgress(100)
          const uploadedFile: UploadedFile = {
            fileUrl: result.data.fileUrl,
            fileName: result.data.fileName,
            fileType: result.data.fileType,
            fileSize: result.data.fileSize,
            isImage: result.data.isImage,
          }

          // Generate preview for images
          if (uploadedFile.isImage) {
            const reader = new FileReader()
            reader.onload = (e) => {
              uploadedFile.preview = e.target?.result as string
              setUploadPreview({ ...uploadedFile, preview: e.target?.result as string })
            }
            reader.readAsDataURL(file)
          }

          setUploadPreview(uploadedFile)
        } else {
          console.error('Upload failed:', result.error)
          setIsUploading(false)
        }
      } catch (error) {
        console.error('Upload error:', error)
        setIsUploading(false)
      }
    }, [])

    const handleFileSelect = useCallback((files: FileList | null) => {
      if (!files || files.length === 0) return
      const file = files[0]

      // Check size limit (10MB)
      if (file.size > 10 * 1024 * 1024) {
        console.error('File too large (max 10MB)')
        return
      }

      uploadFile(file)
    }, [uploadFile])

    const handleInputChange = useCallback(() => {
      const file = fileInputRef.current?.files
      handleFileSelect(file ?? null)
      // Reset input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }, [handleFileSelect])

    const handleCancelUpload = useCallback(() => {
      setIsUploading(false)
      setUploadProgress(0)
      setUploadPreview(null)
    }, [])

    const handleSend = useCallback(() => {
      // If there's an uploaded file, send it
      if (uploadPreview && onSendFile) {
        const caption = content.trim()
        let replyToId: string | undefined
        if (replyingTo && !replyingTo.deletedAt) {
          replyToId = replyingTo.id
        }
        onSendFile(uploadPreview, caption || undefined, replyToId)
        setContent('')
        setUploadPreview(null)
        setIsUploading(false)
        setUploadProgress(0)
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
        }
        return
      }

      const trimmed = content.trim()
      if (!trimmed || disabled) return

      let replyToId: string | undefined
      if (replyingTo && !replyingTo.deletedAt) {
        replyToId = replyingTo.id
      }

      onSend(trimmed, replyToId)
      setContent('')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }, [content, disabled, onSend, replyingTo, uploadPreview, onSendFile])

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          handleSend()
        }
        if (e.key === 'Escape') {
          if (uploadPreview) {
            handleCancelUpload()
            return
          }
          if (editingMessage && onCancelEdit) {
            onCancelEdit()
          }
          if (replyingTo && onCancelReply) {
            onCancelReply()
          }
        }
      },
      [handleSend, editingMessage, onCancelEdit, replyingTo, onCancelReply, uploadPreview, handleCancelUpload]
    )

    const handleInput = useCallback(() => {
      const textarea = textareaRef.current
      if (textarea) {
        textarea.style.height = 'auto'
        textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`
        setContent(textarea.value)
        if (onInputCallback) onInputCallback()
      }
    }, [onInputCallback])

    // Drag & drop handlers
    // Clipboard paste handler - supports pasting images directly
    const handlePaste = useCallback((e: ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (file) {
            if (file.size > 10 * 1024 * 1024) return // 10MB limit
            uploadFile(file)
          }
          return
        }
      }
    }, [uploadFile])

    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(true)
    }, [])

    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)
    }, [])

    const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = e.dataTransfer.files
      handleFileSelect(files)
    }, [handleFileSelect])

    const replySender = replyingTo?.sender
    const replyName = replySender?.displayName || replySender?.username || ''
    const isEditing = !!editingMessage
    const showSendButton = content.trim() || uploadPreview
    const showMicButton = !content.trim() && !uploadPreview && !isEditing && onSendVoice

    const handleVoiceSend = useCallback(async (blob: Blob, duration: number) => {
      if (!onSendVoice) return
      // Convert blob to base64
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1] // Remove data:audio/... prefix
        let replyToId: string | undefined
        if (replyingTo && !replyingTo.deletedAt) {
          replyToId = replyingTo.id
        }
        onSendVoice({ blob, duration, base64 }, replyToId)
        if (replyToId) {
          // clear replyingTo is handled by parent
        }
      }
      reader.readAsDataURL(blob)
      setIsRecording(false)
    }, [onSendVoice, replyingTo])

    const handleVoiceCancel = useCallback(() => {
      setIsRecording(false)
    }, [])

    const handleStartRecording = useCallback(() => {
      setIsRecording(true)
    }, [])

    // When recording, show voice recorder instead of normal input
    if (isRecording) {
      return (
        <div className="border-t border-border/30 glass-subtle input-container-glow">
          {/* Reply bar (still show when recording) */}
          {replyingTo && !replyingTo.deletedAt && !isEditing && (
            <div className="px-4 pt-3 pb-0">
              <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/50 dark:bg-muted/30 border border-border/30">
                <div className="h-5 w-5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                  <Reply className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      {replyName}
                    </span>
                    <span className="text-[10px] text-muted-foreground/60">
                      replying to
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 truncate">
                    {replyingTo.content}
                  </p>
                </div>
                {onCancelReply && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:bg-muted/80 flex-shrink-0"
                    onClick={onCancelReply}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
          )}
          <VoiceRecorder onSend={handleVoiceSend} onCancel={handleVoiceCancel} />
        </div>
      )
    }

    return (
      <div className="border-t border-border/30 glass-subtle input-container-glow">
        {/* Reply bar */}
        {replyingTo && !replyingTo.deletedAt && !isEditing && (
          <div className="px-4 pt-3 pb-0">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-muted/50 dark:bg-muted/30 border border-border/30">
              <div className="h-5 w-5 rounded-md bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                <Reply className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    {replyName}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60">
                    replying to
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground/70 truncate">
                  {replyingTo.content}
                </p>
              </div>
              {onCancelReply && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full hover:bg-muted/80 flex-shrink-0"
                  onClick={onCancelReply}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Edit bar */}
        {isEditing && editingMessage && (
          <div className="px-4 pt-3 pb-0">
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30">
              <div className="h-5 w-5 rounded-md bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center flex-shrink-0">
                <svg className="h-3 w-3 text-amber-600 dark:text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                  Editing message
                </span>
                <p className="text-[11px] text-muted-foreground/70 truncate">
                  {editingMessage.content}
                </p>
              </div>
              {onCancelEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 rounded-full hover:bg-muted/80 flex-shrink-0"
                  onClick={onCancelEdit}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Upload preview */}
        {(isUploading || uploadPreview) && (
          <div className="px-4 pt-3 pb-0">
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/50 dark:bg-muted/30 border border-border/30">
              {isUploading && !uploadPreview ? (
                <>
                  <div className="h-10 w-10 rounded-lg bg-muted/40 dark:bg-muted/20 flex items-center justify-center flex-shrink-0">
                    <Loader2 className="h-5 w-5 text-emerald-500 animate-spin" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">Uploading...</p>
                    <div className="mt-1 h-1.5 w-full bg-muted dark:bg-muted/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(uploadProgress, 100)}%` }}
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:bg-muted/80 flex-shrink-0"
                    onClick={handleCancelUpload}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : uploadPreview ? (
                <>
                  {uploadPreview.isImage && uploadPreview.preview ? (
                    <div className="h-10 w-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted/40 dark:bg-muted/20">
                      <img
                        src={uploadPreview.preview}
                        alt={uploadPreview.fileName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-muted/40 dark:bg-muted/20 flex items-center justify-center flex-shrink-0">
                      <FileText className="h-5 w-5 text-emerald-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {uploadPreview.fileName}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {formatFileSize(uploadPreview.fileSize)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-full hover:bg-muted/80 flex-shrink-0"
                    onClick={handleCancelUpload}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Input area */}
        <div
          className={`px-4 py-3 transition-colors duration-200 ${isDragOver ? 'bg-emerald-50 dark:bg-emerald-950/30' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Drag overlay */}
          {isDragOver && (
            <div className="absolute inset-0 flex items-center justify-center bg-emerald-50/90 dark:bg-emerald-950/50 backdrop-blur-sm z-10 rounded-b-2xl pointer-events-none">
              <div className="flex flex-col items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <div className="h-12 w-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <ImageIcon className="h-6 w-6" />
                </div>
                <p className="text-sm font-medium">Drop file to send</p>
              </div>
            </div>
          )}

          <div className="flex items-end gap-2 max-w-4xl mx-auto relative">
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={handleKeyDown}
                onInput={handleInput}
                onPaste={handlePaste}
                placeholder={isEditing ? 'Edit your message...' : uploadPreview ? 'Add a caption...' : 'Type a message...'}
                disabled={disabled || isUploading}
                className="resize-none min-h-[44px] max-h-[150px] pl-4 pr-4 rounded-2xl border-border/40 bg-muted/30 dark:bg-muted/20 text-sm shadow-inner shadow-black/[0.02] dark:shadow-none textarea-smooth-expand textarea-focus-glow placeholder:text-muted-foreground/40"
                rows={1}
              />
            </div>

            {/* Attachment button */}
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.json,.xml,.zip,.rar,.7z"
              onChange={handleInputChange}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 flex-shrink-0 transition-all duration-200 disabled:opacity-40 btn-gradient-hover"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled || isUploading || isEditing}
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>

            {/* Microphone button — only show when input is empty */}
            {showMicButton && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 flex-shrink-0 transition-all duration-200 disabled:opacity-40"
                onClick={handleStartRecording}
                disabled={disabled || isUploading}
                title="Record voice message"
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}

            <EmojiPicker textareaRef={textareaRef} />

            <Button
              onClick={handleSend}
              disabled={!showSendButton || disabled || isUploading}
              size="icon"
              className="h-10 w-10 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white flex-shrink-0 shadow-md shadow-emerald-600/20 hover:shadow-lg hover:shadow-emerald-600/25 transition-all duration-200 disabled:opacity-40 disabled:shadow-none"
            >
              {isEditing ? (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* Character count indicator */}
          {content.length > 200 && (
            <div className="max-w-4xl mx-auto px-1">
              <p className={`text-[10px] text-right transition-colors ${content.length > 900 ? 'text-destructive font-semibold' : content.length > 700 ? 'text-amber-500 dark:text-amber-400' : 'text-muted-foreground/50'}`}>
                {content.length}/1000
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }
)
