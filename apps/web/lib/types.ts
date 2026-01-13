// API response types
export interface TotalUsersResponse {
  total: number
}

export interface RoomUsersResponse {
  count: number
}

export interface RoomUsersErrorResponse {
  error: string
}

export interface HeartbeatResponse {
  success: boolean
  total: number
}
