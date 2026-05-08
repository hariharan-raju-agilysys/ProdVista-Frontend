import { PublicClientApplication, SilentRequest } from '@azure/msal-browser'

export interface CalendarEvent {
  id: string
  date: Date
  title: string
  type: 'meeting' | 'call' | 'release-notes' | 'todo' | 'birthday'
  time?: string
  attendees?: string[]
  isAllDay?: boolean
  details?: string
  releaseNotesSchedule?: { ownerEmail: string; ownerName: string; notes: string }
}

interface GraphMeeting {
  id: string
  createdDateTime: string
  startDateTime: string
  endDateTime: string
  subject: string
  bodyPreview?: string
  organizer?: { emailAddress: { address: string; name: string } }
  attendees?: Array<{ emailAddress: { address: string; name: string } }>
  isOnlineMeeting: boolean
  onlineMeetingUrl?: string
}

interface GraphOnlineMeeting {
  id: string
  createdDateTime: string
  startDateTime: string
  endDateTime: string
  subject: string
  organizer?: { user: { displayName: string; userPrincipalName: string } }
  participants?: Array<{ user: { displayName: string; userPrincipalName: string } }>
  joinWebUrl: string
}

class CalendarService {
  constructor(private msalClient: PublicClientApplication) {
    this.msalClient = msalClient
  }

  /**
   * Get access token for Microsoft Graph
   * Uses MSAL to acquire token with Calendars.Read and OnlineMeetings.Read scopes
   */
  async getGraphToken(): Promise<string> {
    try {
      const accounts = this.msalClient.getAllAccounts()
      if (accounts.length === 0) {
        throw new Error('No user account found')
      }

      const request: SilentRequest = {
        scopes: ['Calendars.Read', 'OnlineMeetings.Read'],
        account: accounts[0],
        forceRefresh: false,
      }

      const response = await this.msalClient.acquireTokenSilent(request)
      return response.accessToken
    } catch (error) {
      console.error('Failed to get Graph token:', error)
      throw new Error('Unable to authenticate with Microsoft Graph')
    }
  }

  /**
   * Fetch calendar events from Microsoft Graph
   * Gets events from the next 30 days
   */
  async getCalendarEvents(): Promise<CalendarEvent[]> {
    try {
      const token = await this.getGraphToken()
      const now = new Date()
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

      const filter = `startDateTime ge '${now.toISOString()}' and startDateTime lt '${endDate.toISOString()}'`
      const url = `https://graph.microsoft.com/v1.0/me/calendarview?$filter=${encodeURIComponent(filter)}&$select=id,subject,bodyPreview,startDateTime,endDateTime,organizer,attendees,isOnlineMeeting,onlineMeetingUrl&$orderby=startDateTime`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Graph API error: ${response.statusText}`)
      }

      const data = await response.json()
      const graphEvents: GraphMeeting[] = data.value || []

      return graphEvents.map(event => this.mapGraphEventToCalendarEvent(event))
    } catch (error) {
      console.error('Failed to fetch calendar events:', error)
      return []
    }
  }

  /**
   * Fetch online meetings from Microsoft Graph
   * Gets only online meetings (Teams, Skype, etc.)
   */
  async getOnlineMeetings(): Promise<CalendarEvent[]> {
    try {
      const token = await this.getGraphToken()
      const now = new Date()
      const endDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days

      const filter = `startDateTime ge '${now.toISOString()}' and startDateTime lt '${endDate.toISOString()}'`
      const url = `https://graph.microsoft.com/v1.0/me/onlineMeetings?$filter=${encodeURIComponent(filter)}&$select=id,subject,startDateTime,endDateTime,organizer,participants,joinWebUrl&$orderby=startDateTime`

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Graph API error: ${response.statusText}`)
      }

      const data = await response.json()
      const graphOnlineMeetings: GraphOnlineMeeting[] = data.value || []

      return graphOnlineMeetings.map(meeting => this.mapGraphOnlineMeetingToCalendarEvent(meeting))
    } catch (error) {
      console.error('Failed to fetch online meetings:', error)
      return []
    }
  }

  /**
   * Map Graph event to CalendarEvent interface
   */
  private mapGraphEventToCalendarEvent(event: GraphMeeting): CalendarEvent {
    const startTime = new Date(event.startDateTime)
    const endTime = new Date(event.endDateTime)

    return {
      id: event.id,
      date: startTime,
      title: event.subject,
      type: event.isOnlineMeeting ? 'call' : 'meeting',
      time: this.formatTime(startTime, endTime),
      attendees: event.attendees?.map(a => a.emailAddress.name) || [],
      details: event.bodyPreview || undefined,
      isAllDay: false,
    }
  }

  /**
   * Map Graph online meeting to CalendarEvent interface
   */
  private mapGraphOnlineMeetingToCalendarEvent(meeting: GraphOnlineMeeting): CalendarEvent {
    const startTime = new Date(meeting.startDateTime)
    const endTime = new Date(meeting.endDateTime)

    return {
      id: meeting.id,
      date: startTime,
      title: meeting.subject,
      type: 'call',
      time: this.formatTime(startTime, endTime),
      attendees: meeting.participants?.map(p => p.user.displayName) || [],
      isAllDay: false,
      details: meeting.joinWebUrl,
    }
  }

  /**
   * Format time range for display
   */
  private formatTime(startTime: Date, endTime: Date): string {
    const start = startTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    const end = endTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    return `${start} - ${end}`
  }
}

// Export CalendarService class for use in components
export { CalendarService }
