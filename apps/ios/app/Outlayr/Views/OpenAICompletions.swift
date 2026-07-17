//
//  OpenAICompletions.swift
//  Outlayr
//

import Foundation

struct OpenAICompletionsResponse: Decodable {
    let id: String
    let choices: [OpenAICompletionsOptions]
}

struct OpenAICompletionsOptions: Decodable {
    let text: String
}
