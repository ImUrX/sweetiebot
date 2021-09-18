const gql = require("fake-tag");

const mediaFields = gql`
fragment mediaFields on Media {
	id,
	title {
		romaji
	}
	siteUrl,
	coverImage {
		large
	}
	isAdult
}
`, reviewFields = gql`
fragment reviewFields on ReviewConnection {
	nodes {
		user {
			name
		}
		rating score
		summary
		id
	}
}
`, charFields = gql`
fragment charFields on CharacterConnection {
	nodes {
		name {
			full
			native
		}
		description
		siteUrl
		image {
			large
		}
		favourites
	}
}
`, staffFields = gql`
fragment staffFields on StaffConnection {
	nodes {
		id
		siteUrl
		name {
			full 
			native
		}
		image {
			large
		}
		staffMedia (sort: [POPULARITY_DESC], perPage: $mediaAmount) {
			nodes {
				id
				title {
					romaji
				}
				siteUrl
			}
			edges {
				staffRole
			}
		}
		characters (sort: [FAVOURITES_DESC], perPage: $charAmount) {
			nodes {
				name {
					full
					native
				}
				siteUrl
				media {
					nodes {
						id
						title {
							romaji
						}
						siteUrl
					}
				}
			}
		}
		favourites
	}
	edges {
		role
	}
}
`, recFields = gql`
fragment recFields on RecommendationConnection {
	nodes {
		mediaRecommendation {
			siteUrl
			title {
				romaji
			}
		}
		user {
			name
		}
		rating
	}
}
`, fuzzyFields = gql`
fragment fuzzyFields on FuzzyDate {
	year month day
}
`, animeSearch = gql`
query AnimeSearch ($searchStr: String) {
	Page (perPage: 10) {
		media (search: $searchStr, type: ANIME) {
			...mediaFields
		}
	}
}
${mediaFields}
`, animeQuery = gql`
query AnimeQuery ($searchStr: String, $id: Int, $reaction: Boolean!, $mediaAmount: Int = 2, $charAmount: Int = 2) {
  Media (search: $searchStr, id: $id, type: ANIME) {
	...mediaFields
	idMal
	title {
		native
		english
	}
	description (asHtml: false)
	genres
	format status
	episodes duration
	season seasonYear
	startDate {
		...fuzzyFields
	}
	endDate {
		...fuzzyFields
	}
	coverImage {
		color
	}
	source(version: 2)
	averageScore meanScore
	popularity favourites
	relations {
		edges {
			relationType(version: 2)
		}
		nodes {
			title {
				romaji
			}
			siteUrl
		}
	}
	trailer {
		site
		id
	}
	externalLinks {
      url
      site
    }
	staff (sort: [FAVOURITES_DESC], perPage: 3) @include(if: $reaction) {
		...staffFields
	}
	studios (sort: [NAME_DESC], isMain: true) {
		nodes {
			siteUrl
			name
		}
	}
	characters (sort: [FAVOURITES_DESC], perPage: 3) @include(if: $reaction) {
		...charFields
	}
	recommendations (sort: [RATING_DESC], perPage: 5) @include(if: $reaction) {
		...recFields
	}
	reviews (sort: [RATING_DESC], perPage: 5) @include(if: $reaction) {
		...reviewFields
	}
  }
}
${charFields}${reviewFields}${recFields}${staffFields}${fuzzyFields}${mediaFields}
`, characterQuery = gql`
query CharacterQuery  ($searchStr: String, $id: Int, $amount: Int!) {
	Media (search: $searchStr, id: $id, type: ANIME) {
		...mediaFields
		characters (sort: [FAVOURITES_DESC], perPage: $amount) {
			...charFields
		}
	}
}
${charFields}${mediaFields}
`, staffQuery = gql`
query StaffQuery  ($searchStr: String, $id: Int, $amount: Int!, $mediaAmount: Int = 3, $charAmount: Int = 3) {
	Media (search: $searchStr, id: $id, type: ANIME) {
		...mediaFields
		staff (sort: [FAVOURITES_DESC], perPage: $amount) {
			...staffFields
		}
	}
}
${staffFields}${mediaFields}
`, reviewQuery = gql`
query ReviewQuery  ($searchStr: String, $id: Int, $amount: Int!) {
	Media (search: $searchStr, id: $id, type: ANIME) {
		...mediaFields
		reviews (sort: [RATING_DESC], perPage: $amount) {
			...reviewFields
		}
	}
}
${reviewFields}${mediaFields}
`, recQuery = gql`
query RecQuery  ($searchStr: String, $id: Int, $amount: Int!) {
	Media (search: $searchStr, id: $id, type: ANIME) {
		...mediaFields
		recommendations (sort: [RATING_DESC], perPage: $amount) {
			...recFields
		}
	}
}
${recFields}${mediaFields}
`;

module.exports = {
	mediaFields, charFields, reviewFields, recFields, staffFields, fuzzyFields,
	animeSearch, animeQuery, characterQuery, staffQuery, reviewQuery, recQuery
};
