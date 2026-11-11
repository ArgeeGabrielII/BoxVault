import Foundation

struct HealthResponse: Decodable {
    let status: String
    let service: String
}

struct APIClient {
    static let shared = APIClient()

    // Simulator: localhost reaches the developer Mac.
    // For physical devices configure a secure LAN or HTTPS host.
    private let baseURL = URL(string: "http://localhost:3000/api/v1")!

    func healthStatus() async -> String {
        do {
            let (data, response) = try await URLSession.shared.data(from: baseURL.appendingPathComponent("health"))
            guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
                return "API unavailable"
            }
            let result = try JSONDecoder().decode(HealthResponse.self, from: data)
            return result.status == "ok" ? "API online" : "API unavailable"
        } catch {
            return "API offline — start NestJS locally"
        }
    }
}
