import { QualityWorkItemDto } from '../../services/qualityService'

export interface HnItem {
  objectID: string
  title: string
  url?: string
  author: string
  points: number
  num_comments: number
  created_at_i: number
}

export interface TechByte {
  id: string
  title: string
  description: string
  type: 'image' | 'document' | 'text' | 'url'
  content: string
  uploadedBy: string
  uploadedAt: Date
  tags: string[]
}

export interface CalendarEvent {
  id: string
  title: string
  date: Date
  type: 'meeting' | 'deadline' | 'release' | 'birthday'
  description?: string
  attendees?: string[]
}

export interface Birthday {
  userId: string
  userName: string
  month: number
  day: number
  email?: string
}

export interface WorkItemModalProps {
  isOpen: boolean
  title: string
  subtitle: string
  items: QualityWorkItemDto[]
  onClose: () => void
  onItemClick: (item: QualityWorkItemDto) => void
  loading?: boolean
}

export interface AIInsightModalProps {
  isOpen: boolean
  title: string
  description: string
  items: QualityWorkItemDto[]
  onClose: () => void
  loading?: boolean
}
