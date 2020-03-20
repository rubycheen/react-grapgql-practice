import React, { Component } from 'react';
import axios from 'axios';

const TITLE = 'React GraphQL GitHub Client';

const axiosGitHubGraphQL = axios.create({ //Github token
  baseURL: 'https://api.github.com/graphql',
  headers: {
    Authorization: `bearer ${
      process.env.REACT_APP_GITHUB_PERSONAL_ACCESS_TOKEN
    }`,
  },
});

const GET_ISSUES_OF_REPOSITORY = `
  query (
    $organization: String!, 
    $repository: String!,
    $cursor: String
  ) {
    organization(login: $organization){
      name
      url
      repository(name: $repository) {
        name
        id
        url
        stargazers {
          totalCount
        }
        viewerHasStarred
        issues(last: 20, after: $cursor, states: [OPEN]) {
          edges {
            node {
              id
              title
              url
              reactions(last: 3){
                edges {
                  node {
                    id
                    content
                  }
                }
              }
            }
          }
          totalCount
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }
  }
`;

const ADD_STAR = `
  mutation ($repositoryId: ID!) {
    addStar(input:{starrableId:$repositoryId}) {
      starrable {
        viewerHasStarred
      }
    }
  }
`;

const getIssuesOfRepository = (path, cursor) => {
  const [organization, repository] = path.split('/');

  return axiosGitHubGraphQL.post('',{
    query: GET_ISSUES_OF_REPOSITORY,
    variables: {organization, repository, cursor}, //variable只有3個？
  });
};

{/*兩個arrow function 是什麼意思 */}
const resolveIssuesQuery = (queryResult, cursor) => state => { 
  const {data, errors} =  queryResult.data;
  if (!cursor) {
    return {
      organization: data.organization,
      errors,
    };
  }

  const {edges: oldIssues } = state.organization.repository.issues;
  const {edges: newIssues } = data.organization.repository.issues;
  const updatedIssues = [...oldIssues, ...newIssues]
  return{
    organization: {
      ...data.organization,
      repository: {
        ...data.organization.repository,
        issues: {
          ...data.organization.repository.issues,
          edges: updatedIssues,
        },
      },
    },
    errors,
  };
};

/*下面為更改遠端Github情況*/
const addStarToRepository = repositoryId => {
  return axiosGitHubGraphQL.post('',{
    query: ADD_STAR,
    variables: {repositoryId},
  });
};

//調整更改此頁面狀態
const resolveAddStarMutation = mutationResult => state => {
  // const {
  //   viewerHasStarred,
  // } = mutationResult.data.data.addStar.starrable; /* ??? */

  console.log(`mutation result`, mutationResult)

  // const { totalCount } = state.organization.repository.stargazers;
  // return {
  //   ...state,
  //   organization: {
  //     ...state.organization,
  //     repository: {
  //       ...state.organization.repository,
  //       viewerHasStarred,
  //       stargazers: {
  //         totalCount: totalCount + 1,
  //       }
  //     },
  //   },
  // };
};


class App extends Component {
  state = {
    path: 'the-road-to-learn-react/the-road-to-learn-react',
    organization: null,
    errors: null,
  };

  /*以下不用在App外面定義const 這些是他提供的API？ */
  componentDidMount() { // 等網頁其他骨幹先載入
    this.onFetchFromGitHub(this.state.path); 
    // console.log(this.state.path)
  };

  onChange = event => {
    this.setState({ path: event.target.value });
    // console.log(this.state.path)
  };

  onSubmit = event => {
    // fetch data
    this.onFetchFromGitHub(this.state.path)
    event.preventDefault();
    // console.log(this.state.path)
  };

  onFetchFromGitHub = (path, cursor) => {
    getIssuesOfRepository(path, cursor).then(queryResult => {
      const callback = state => { 
        const {data, errors} =  queryResult.data;
        if (!cursor) {
          return {
            organization: data.organization,
            errors,
          };
        }
      
        const {edges: oldIssues } = state.organization.repository.issues;
        const {edges: newIssues } = data.organization.repository.issues;
        const updatedIssues = [...oldIssues, ...newIssues]
        return{
          organization: {
            ...data.organization,
            repository: {
              ...data.organization.repository,
              issues: {
                ...data.organization.repository.issues,
                edges: updatedIssues,
              },
            },
          },
          errors,
        };
      }
      return this.setState(state => callback(state))
      // return this.setState(resolveIssuesQuery(queryResult, cursor))
    });
  };

  onFetchMoreIssues = () => {
    const {
      endCursor,
    } = this.state.organization.repository.issues.pageInfo;

    this.onFetchFromGitHub(this.state.path, endCursor);
    // console.log(this.state.path)

  };

  onStarRepository = (repositoryId, viewerHasStarred) => {
    addStarToRepository(repositoryId).then(mutationResult =>
      this.setState(resolveAddStarMutation(mutationResult)),
      );
  };

  render() {
    const { path, organization, errors } = this.state;
    console.log("state",this.state)
    console.log("path",this.state.path)

    return (
      <div>
        <h1>{TITLE}</h1>
        <form onSubmit={this.onSubmit}> 
          <label htmlFor="url">
            Show open issues for https://github.com/
          </label>
          <input
            id="url"
            type="text"
            value={path}
            onChange={this.onChange}  //什麼意思？？
            style={{ width: '300px' }}
          />
          <button type="submit">Search</button>
        </form>
        <hr />

        { organization ? (
          <Organization 
          organization={organization} 
          errors={errors}
          onFetchMoreIssues={this.onFetchFromGitHub}
          onStarRepository={this.onStarRepository}
          />
        ) : (
          <p>No information yet ...</p>
        )}
      </div>


    );
  }
}

const Organization = ({ 
  organization, 
  errors,
  onFetchMoreIssues,
  onStarRepository
 }) => {
  if (errors) {
    return (
      <p>
        <strong>Something went wrong:</strong>
        {errors.map(error => error.message).join(' ')}
      </p>
    );
  }
  return (
    <div>
      <p>
        <strong>Issues from Organization:</strong>
        <a href={organization.url}>{organization.name}</a>
      </p>
      <Repository 
      repository={organization.repository} //為什麼要organization. 其他不用？若不用限定為什麼上面還要傳入參數？
      onFetchMoreIssues={onFetchMoreIssues}
      onStarRepository={onStarRepository}
      />
    </div>
  );
};

const Repository = ({ 
  repository,
  onFetchMoreIssues,
  onStarRepository
 }) => (
  <div>
    <p>
      <strong>In Reposity:</strong>
      <a href={repository.url}>{repository.name}</a>
    </p>
    <button onClick={() => onStarRepository(repository.id, repository.viewerHasStarred)}>
      {/*下面的寫法是固定的, boolean variable ? A : B*/}
      {repository.stargazers.totalCount}
      {repository.viewerHasStarred ? 'Unstar': 'Star'}
    </button>
   
    <ul>
      {repository.issues.edges.map(issue => (
        <li key={issue.node.id}>
          <a href={issue.node.url}>{issue.node.title}</a>
          <ul>
            {issue.node.reactions.edges.map(reaction => (
              <li key={reaction.node.id}>{reaction.node.content}</li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
    <hr />
    {repository.issues.pageInfo.hasNextPage && (
      <button onClick={onFetchMoreIssues}>More</button>
    )}
  </div>
)

// ReactDOM.render(<App />,document.getElementById('root'))

export default App;
