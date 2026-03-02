export interface ApiClientOptions {
  baseUrl?: string
  token?: string
}

export class ApiClient {
  constructor(private readonly options: ApiClientOptions = {}) {}

  async get<T>(path: string): Promise<T> {
    const response = await fetch(this.resolve(path), {
      method: 'GET',
      headers: this.createHeaders(),
    })

    if (!response.ok) {
      throw new Error(`GET ${path} failed: ${response.status}`)
    }

    return response.json() as Promise<T>
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(this.resolve(path), {
      method: 'POST',
      headers: this.createHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      throw new Error(`POST ${path} failed: ${response.status}`)
    }

    return response.json() as Promise<T>
  }

  async patch<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(this.resolve(path), {
      method: 'PATCH',
      headers: this.createHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!response.ok) {
      throw new Error(`PATCH ${path} failed: ${response.status}`)
    }

    return response.json() as Promise<T>
  }

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(this.resolve(path), {
      method: 'DELETE',
      headers: this.createHeaders(),
    })

    if (!response.ok) {
      throw new Error(`DELETE ${path} failed: ${response.status}`)
    }

    return response.json() as Promise<T>
  }

  private resolve(path: string): string {
    const base = this.options.baseUrl ?? ''
    return `${base}${path}`
  }

  private createHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }

    if (this.options.token) {
      headers.Authorization = `Bearer ${this.options.token}`
    }

    return headers
  }
}

export const apiClient = new ApiClient()
