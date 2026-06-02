const callerProfile = { is_super_agent: true };
const isPromotingToFullAgent = callerProfile.is_super_agent === true;
const is_sub_agent = !isPromotingToFullAgent;
console.log({ isPromotingToFullAgent, is_sub_agent });
