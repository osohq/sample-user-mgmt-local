// next.config.js
module.exports = {
  async redirects() {
    return [
      {
        source: "/",
        destination: "/user",
        permanent: true,
      },
    ];
  },
};
