//
//  OpenAICompletionsResponse.swift
//  Outlayr
//

import Foundation

struct OpenAICompletionsResponse: Decodable {
    let id: String
    let choices: [OpenAICompletionsOptions]
}
